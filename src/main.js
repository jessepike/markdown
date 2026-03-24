import './style.css';
import { createEditor, toggleSearch, setEditorTheme } from './editor.js';
import DOMPurify from 'dompurify';
import { readTextFile, writeTextFile, stat, mkdir, writeFile, exists } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { prefs } from './preferences.js';
import { prefsUI } from './preferences-ui.js';
import { statusBar } from './status-bar.js';
import { reloadPromptUI } from './reload-prompt-ui.js';
import { Sidebar } from './sidebar.js';
import { tabs } from './tabs.js';
import { exportToDocx } from './docx-export.js';
import { showOnboarding } from './onboarding.js';
import { clipboardShelf } from './clipboard-shelf.js';
import { promptLibrary } from './prompt-library.js';

const RECENT_FILES_KEY = 'pike-recent-files';
const SPLIT_RATIO_KEY = 'pike-split-ratio';
const VIEW_MODE_KEY = 'pike-view-mode';
const SYNC_SCROLL_KEY = 'pike-sync-scroll';
const RENDER_FM_KEY = 'pike-render-fm';
const MAX_RECENT_FILES = 10;
const UNTITLED_TITLE = 'Untitled';
const SCRATCH_TAB_PATH = 'scratch://untitled';
const TEMP_TAB_PREFIX = 'scratch://temp-';
const SCRATCH_FILE = 'scratchpad.md';
const TEMP_SESSION_FILE = 'temp-tabs-session.json';
const TEMP_TAB_WARNING_THRESHOLD = 50;
const APP_IMAGE_MARKDOWN_PREFIX = 'app-images/';
const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const WEB_SCRATCH_KEY = 'agentpad-web-workspace';
const WEB_TEMP_SESSION_KEY = 'agentpad-web-temp-session';

// Helper function to set window title using Tauri API
async function setWindowTitle(title) {
    try {
        const safeTitle = typeof title === 'string' && title.trim().length > 0
            ? title
            : UNTITLED_TITLE;
        const docTitle = safeTitle.split(/[/\\]/).pop() || safeTitle;
        document.title = docTitle;
        if (!isTauriRuntime) return;
        const window = getCurrentWindow();
        await window.setTitle(safeTitle);
    } catch (err) {
        console.error('Failed to set window title:', err);
    }
}

// State Variables
// Duplicates removed

// State Variables
let viewMode = 'editor';
let isSyncScrollEnabled = localStorage.getItem(SYNC_SCROLL_KEY) !== 'false';
let isRenderFmEnabled = localStorage.getItem(RENDER_FM_KEY) !== 'false';

let currentFilePath = null;
let openDocuments = new Map(); // path -> { content, lastSavedContent, isDirty, displayName? }
let debounceTimer = null;
let isPreviewPaused = false;
let isSaving = false; // Latch to prevent self-triggering watcher
let lastSavedContent = ''; // Debounce self-edits
let lastKnownMtime = 0;
let scratchStoragePath = null;
let scratchPersistTimer = null;
let tempSessionStoragePath = null;
let tempSessionPersistTimer = null;
let virtualImagesDirPath = null;
let tempTabCounter = 1;
let didWarnTempTabs = false;
let sidebar = null;

function isScratchpadPath(path) {
    return path === SCRATCH_TAB_PATH;
}

function isTempTabPath(path) {
    return typeof path === 'string' && path.startsWith(TEMP_TAB_PREFIX);
}

function isVirtualTabPath(path) {
    return isScratchpadPath(path) || isTempTabPath(path);
}

function getBasename(path) {
    return path.split(/[/\\]/).pop();
}

function getNextTempTabName() {
    const names = Array.from(openDocuments.values())
        .map(doc => doc.displayName || '')
        .filter(name => /^Temp \\d+$/.test(name));
    if (names.length === 0) return `Temp ${tempTabCounter++}`;

    const max = Math.max(...names.map(name => Number(name.replace('Temp ', ''))));
    tempTabCounter = Math.max(tempTabCounter, max + 1);
    return `Temp ${tempTabCounter++}`;
}

async function getScratchStoragePath() {
    if (!isTauriRuntime) return WEB_SCRATCH_KEY;
    if (scratchStoragePath) return scratchStoragePath;
    const configDir = await appConfigDir();
    if (!(await exists(configDir))) {
        await mkdir(configDir, { recursive: true });
    }
    scratchStoragePath = await join(configDir, SCRATCH_FILE);
    return scratchStoragePath;
}

async function getTempSessionStoragePath() {
    if (!isTauriRuntime) return WEB_TEMP_SESSION_KEY;
    if (tempSessionStoragePath) return tempSessionStoragePath;
    const configDir = await appConfigDir();
    if (!(await exists(configDir))) {
        await mkdir(configDir, { recursive: true });
    }
    tempSessionStoragePath = await join(configDir, TEMP_SESSION_FILE);
    return tempSessionStoragePath;
}

async function getVirtualImagesDirPath() {
    if (virtualImagesDirPath) return virtualImagesDirPath;
    const configDir = await appConfigDir();
    if (!(await exists(configDir))) {
        await mkdir(configDir, { recursive: true });
    }
    virtualImagesDirPath = await join(configDir, 'images');
    if (!(await exists(virtualImagesDirPath))) {
        await mkdir(virtualImagesDirPath, { recursive: true });
    }
    return virtualImagesDirPath;
}

async function loadScratchpadContent() {
    try {
        const scratchPath = await getScratchStoragePath();
        if (!isTauriRuntime) return localStorage.getItem(scratchPath) || '';
        if (!(await exists(scratchPath))) return '';
        return await readTextFile(scratchPath);
    } catch (err) {
        console.error('Failed to load scratchpad:', err);
        return '';
    }
}

async function persistScratchpad(content, immediate = false) {
    const write = async () => {
        try {
            const scratchPath = await getScratchStoragePath();
            if (!isTauriRuntime) {
                localStorage.setItem(scratchPath, content);
            } else {
                await writeTextFile(scratchPath, content);
            }
            const scratchDoc = openDocuments.get(SCRATCH_TAB_PATH);
            if (scratchDoc) {
                scratchDoc.lastSavedContent = content;
                scratchDoc.isDirty = false;
                tabs.setDirty(SCRATCH_TAB_PATH, false);
            }
            if (currentFilePath === SCRATCH_TAB_PATH) {
                lastSavedContent = content;
            }
        } catch (err) {
            console.error('Failed to persist scratchpad:', err);
        }
    };

    if (immediate) {
        if (scratchPersistTimer) clearTimeout(scratchPersistTimer);
        scratchPersistTimer = null;
        await write();
        return;
    }

    if (scratchPersistTimer) clearTimeout(scratchPersistTimer);
    scratchPersistTimer = setTimeout(() => {
        scratchPersistTimer = null;
        write();
    }, 400);
}

async function ensureScratchpadTab() {
    if (!openDocuments.has(SCRATCH_TAB_PATH)) {
        const content = await loadScratchpadContent();
        openDocuments.set(SCRATCH_TAB_PATH, {
            content,
            lastSavedContent: content,
            isDirty: false,
            displayName: 'Workspace'
        });
    }

    tabs.addTab(SCRATCH_TAB_PATH, { name: 'Workspace', closable: false, activate: false });
    tabs.setDirty(SCRATCH_TAB_PATH, false);
}

function getTempTabDocuments() {
    return Array.from(openDocuments.entries())
        .filter(([path]) => isTempTabPath(path))
        .map(([path, doc]) => ({
            path,
            content: doc.content || '',
            lastSavedContent: doc.lastSavedContent || '',
            isDirty: !!doc.isDirty,
            displayName: doc.displayName || getBasename(path),
            updatedAt: doc.updatedAt || Date.now()
        }));
}

function getFileBackedTabs() {
    return Array.from(openDocuments.entries())
        .filter(([path]) => !isVirtualTabPath(path))
        .map(([path, doc]) => ({
            path,
            displayName: doc.displayName || getBasename(path),
        }));
}

async function persistTempSession(immediate = false) {
    const write = async () => {
        try {
            const sessionPath = await getTempSessionStoragePath();
            const payload = {
                version: 1,
                savedAt: Date.now(),
                activePath: currentFilePath || SCRATCH_TAB_PATH,
                tempTabs: getTempTabDocuments(),
                fileTabs: getFileBackedTabs(),
            };
            if (!isTauriRuntime) {
                localStorage.setItem(sessionPath, JSON.stringify(payload));
            } else {
                await writeTextFile(sessionPath, JSON.stringify(payload, null, 2));
            }
        } catch (err) {
            console.error('Failed to persist temp tabs session:', err);
        }
    };

    if (immediate) {
        if (tempSessionPersistTimer) clearTimeout(tempSessionPersistTimer);
        tempSessionPersistTimer = null;
        await write();
        return;
    }

    if (tempSessionPersistTimer) clearTimeout(tempSessionPersistTimer);
    tempSessionPersistTimer = setTimeout(() => {
        tempSessionPersistTimer = null;
        write();
    }, 450);
}

async function loadTempSession() {
    try {
        const sessionPath = await getTempSessionStoragePath();
        if (!isTauriRuntime) {
            const raw = localStorage.getItem(sessionPath);
            if (!raw) return { activePath: null, tempTabs: [], fileTabs: [] };
            const parsed = JSON.parse(raw);
            const tempTabs = Array.isArray(parsed.tempTabs) ? parsed.tempTabs : [];
            const fileTabs = Array.isArray(parsed.fileTabs) ? parsed.fileTabs : [];
            return {
                activePath: typeof parsed.activePath === 'string' ? parsed.activePath : null,
                tempTabs: tempTabs.filter(tab => tab && typeof tab.path === 'string' && isTempTabPath(tab.path)),
                fileTabs: fileTabs.filter(tab => tab && typeof tab.path === 'string' && !isVirtualTabPath(tab.path)),
            };
        }
        if (!(await exists(sessionPath))) return { activePath: null, tempTabs: [], fileTabs: [] };
        const raw = await readTextFile(sessionPath);
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { activePath: null, tempTabs: [], fileTabs: [] };
        const tempTabs = Array.isArray(parsed.tempTabs) ? parsed.tempTabs : [];
        const fileTabs = Array.isArray(parsed.fileTabs) ? parsed.fileTabs : [];
        return {
            activePath: typeof parsed.activePath === 'string' ? parsed.activePath : null,
            tempTabs: tempTabs.filter(tab => tab && typeof tab.path === 'string' && isTempTabPath(tab.path)),
            fileTabs: fileTabs.filter(tab => tab && typeof tab.path === 'string' && !isVirtualTabPath(tab.path)),
        };
    } catch (err) {
        console.error('Failed to load temp tabs session:', err);
        return { activePath: null, tempTabs: [], fileTabs: [] };
    }
}

async function maybePromptTempTabCleanup() {
    const tempTabs = getTempTabDocuments();
    if (tempTabs.length <= TEMP_TAB_WARNING_THRESHOLD || didWarnTempTabs) return;
    didWarnTempTabs = true;

    const shouldCleanup = confirm(
        `You have ${tempTabs.length} temporary tabs. Keep only the newest ${TEMP_TAB_WARNING_THRESHOLD}?`
    );
    if (!shouldCleanup) return;

    tempTabs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const keep = new Set(tempTabs.slice(0, TEMP_TAB_WARNING_THRESHOLD).map(tab => tab.path));
    const remove = tempTabs.filter(tab => !keep.has(tab.path)).map(tab => tab.path);

    for (const path of remove) {
        openDocuments.delete(path);
        tabs.removeTab(path);
    }

    if (currentFilePath && !openDocuments.has(currentFilePath)) {
        await ensureScratchpadTab();
        await switchTab(SCRATCH_TAB_PATH);
    }

    await persistTempSession(true);
    clipboardShelf.toast(`Trimmed temporary tabs to ${TEMP_TAB_WARNING_THRESHOLD}.`);
}

async function preparePreviewContent(content) {
    if (typeof content !== 'string' || !content.includes(APP_IMAGE_MARKDOWN_PREFIX)) {
        return content;
    }

    const imagesDir = await getVirtualImagesDirPath();
    const imageLinkRegex = /(!\[[^\]]*]\()\s*app-images\/([^) \t\r\n]+)\s*(\))/g;
    let lastIndex = 0;
    let rewritten = '';
    let replaced = false;
    let match;

    while ((match = imageLinkRegex.exec(content)) !== null) {
        const [, prefix, rawName, suffix] = match;
        const safeName = String(rawName || '')
            .split('/')
            .filter((segment) => segment && segment !== '.' && segment !== '..')
            .join('/');

        if (!safeName) continue;

        const absoluteImagePath = await join(imagesDir, safeName);
        const previewSrc = encodeURI(convertFileSrc(absoluteImagePath));
        rewritten += content.slice(lastIndex, match.index);
        // Angle brackets ensure markdown parser accepts URLs with encoded/special chars reliably.
        rewritten += `${prefix}<${previewSrc}>${suffix}`;
        lastIndex = match.index + match[0].length;
        replaced = true;
    }

    if (!replaced) return content;
    rewritten += content.slice(lastIndex);
    return rewritten;
}

function postRenderUpdate(content) {
    const docType = getDocumentType(currentFilePath);
    preparePreviewContent(content)
        .then((preparedContent) => {
            worker.postMessage({
                content: preparedContent,
                options: { renderFrontmatter: isRenderFmEnabled, docType }
            });
        })
        .catch((err) => {
            console.error('Failed to prepare preview content:', err);
            worker.postMessage({
                content,
                options: { renderFrontmatter: isRenderFmEnabled, docType }
            });
        });
}

function getDocumentType(path) {
    if (!path || isVirtualTabPath(path)) return 'markdown';
    const lower = path.toLowerCase();
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
    return 'markdown';
}

function decodeDataUrlToBytes(dataUrl) {
    const parts = String(dataUrl).split(',');
    if (parts.length < 2) return null;
    const metadata = parts[0];
    const base64Payload = parts.slice(1).join(',');
    const mimeMatch = metadata.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/i);
    if (!mimeMatch) return null;

    try {
        const binary = atob(base64Payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return { mime: mimeMatch[1].toLowerCase(), bytes };
    } catch {
        return null;
    }
}

async function migrateInlineDataImages(content) {
    if (typeof content !== 'string' || !content.includes('data:image/')) {
        return content;
    }

    const dataImageRegex = /!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+)\)/g;
    const extByMime = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/bmp': 'bmp',
        'image/tiff': 'tiff',
        'image/heic': 'heic'
    };

    const imagesDir = await getVirtualImagesDirPath();
    let cursor = 0;
    let rewritten = '';
    let index = 0;
    let match;

    while ((match = dataImageRegex.exec(content)) !== null) {
        const [fullMatch, altRaw, dataUrl] = match;
        rewritten += content.slice(cursor, match.index);

        const decoded = decodeDataUrlToBytes(dataUrl);
        if (!decoded) {
            rewritten += fullMatch;
            cursor = match.index + fullMatch.length;
            continue;
        }

        const extension = extByMime[decoded.mime] || 'png';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `clip-migrated-${timestamp}-${index}.${extension}`;
        index += 1;

        try {
            const fullPath = await join(imagesDir, filename);
            await writeFile(fullPath, decoded.bytes);
            const safeAlt = (altRaw || 'Image').replace(/\r?\n/g, ' ').trim() || 'Image';
            rewritten += `![${safeAlt}](${APP_IMAGE_MARKDOWN_PREFIX}${filename})`;
        } catch (err) {
            console.warn('Failed to migrate inline image, keeping original data URL:', err);
            rewritten += fullMatch;
        }

        cursor = match.index + fullMatch.length;
    }

    if (cursor === 0) return content;
    rewritten += content.slice(cursor);
    return rewritten;
}

function getCurrentContent() {
    return editor.state.doc.toString();
}

function getActiveDocument() {
    if (!currentFilePath) return null;
    return openDocuments.get(currentFilePath) || null;
}

function updateDirtyState(content) {
    if (!currentFilePath) return;
    const doc = openDocuments.get(currentFilePath);
    if (!doc) return;

    doc.content = content;
    doc.isDirty = content !== doc.lastSavedContent;
    doc.updatedAt = Date.now();
    tabs.setDirty(currentFilePath, doc.isDirty);
}

function markCurrentDocumentSaved(content) {
    if (!currentFilePath) return;
    const doc = openDocuments.get(currentFilePath);
    if (!doc) return;

    doc.content = content;
    doc.lastSavedContent = content;
    doc.isDirty = false;
    doc.updatedAt = Date.now();
    tabs.setDirty(currentFilePath, false);
}

function hasUnsavedChanges() {
    const content = getCurrentContent();

    if (currentFilePath) {
        const doc = openDocuments.get(currentFilePath);
        if (doc) return doc.isDirty;
        return content !== lastSavedContent;
    }

    // Scratch/untitled state with no path yet.
    return content.trim().length > 0;
}

async function ensureCanDiscardUnsavedChanges(actionLabel = 'continue') {
    if (!hasUnsavedChanges()) return true;
    return confirm(`You have unsaved changes. Discard them and ${actionLabel}?`);
}

async function openPathWithUnsavedCheck(path, actionLabel = 'open another file') {
    await loadFile(path);
    return true;
}

async function addSelectionToShelf() {
    const sel = editor.state.selection.main;
    if (sel.from === sel.to) {
        clipboardShelf.toast('Select text in editor first', 'warn');
        return;
    }
    const selectedText = editor.state.doc.sliceString(sel.from, sel.to);
    await clipboardShelf.addText(selectedText, 'selection');
}

function refreshSidebarCollections() {
    if (!sidebar) return;
    const tempTabs = Array.from(openDocuments.entries())
        .filter(([path]) => isTempTabPath(path))
        .map(([path, doc]) => ({
            path,
            displayName: doc.displayName || getBasename(path)
        }));
    sidebar.setData({
        clips: clipboardShelf.getItems().slice(0, 40),
        prompts: promptLibrary.getItems().slice(0, 40),
        recentFiles: getRecentFiles(),
        tempTabs
    });
    updateTopbar();
}

function getPromptCategories() {
    const categories = new Set(['general']);
    promptLibrary.getItems().forEach((item) => categories.add(item.category || 'general'));
    return ['all', ...Array.from(categories).sort()];
}

function getLibraryPrompts() {
    return promptLibrary.search(libraryState.query, {
        category: libraryState.category,
    });
}

function getSelectedPrompt() {
    const prompts = getLibraryPrompts();
    if (!prompts.length) return null;
    const selected = prompts.find((item) => item.id === libraryState.selectedPromptId);
    return selected || prompts[0];
}

function getVisibleShelfItems() {
    const query = shelfState.query || '';
    return clipboardShelf.getItems().filter((item) => {
        const hay = `${item.title}\n${item.text}\n${item.kind}\n${(item.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(query.trim().toLowerCase());
    });
}

function getSelectedShelfItem() {
    const items = getVisibleShelfItems();
    if (!items.length) return null;
    const selected = items.find((item) => item.id === shelfState.selectedItemId);
    return selected || items[0];
}

function getSearchResults() {
    const query = searchState.query.trim();
    if (!query) return [];

    const results = [];
    promptLibrary.search(query).forEach((prompt) => {
        results.push({ type: 'prompt', id: prompt.id, title: prompt.title, subtitle: prompt.category || 'general', payload: prompt });
    });
    clipboardShelf.getItems().forEach((item) => {
        const hay = `${item.title}\n${item.text}\n${item.kind}\n${(item.tags || []).join(' ')}`.toLowerCase();
        if (hay.includes(query.toLowerCase())) {
            results.push({ type: 'shelf', id: item.id, title: item.title, subtitle: item.kind, payload: item });
        }
    });
    tabs.getTabs().forEach((tab) => {
        if (tab.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({ type: 'tab', id: tab.path, title: tab.name, subtitle: 'Open tab', payload: tab });
        }
    });
    getRecentFiles().forEach((path) => {
        const name = getBasename(path);
        if (name.toLowerCase().includes(query.toLowerCase()) || path.toLowerCase().includes(query.toLowerCase())) {
            results.push({ type: 'file', id: path, title: name, subtitle: path, payload: path });
        }
    });

    return results.filter((result) => searchState.filter === 'all' || result.type === searchState.filter);
}

async function createPromptFromCurrent() {
    const sel = editor.state.selection.main;
    const selectedText = sel.from === sel.to ? '' : editor.state.doc.sliceString(sel.from, sel.to);
    const text = selectedText || editor.state.doc.toString();
    const promptText = text.trim() ? text : '# New Prompt\n\nDescribe the task, context, and output you need.';
    const promptRecord = await promptLibrary.addPrompt(promptText);
    libraryState.selectedPromptId = promptRecord?.id || null;
    setActiveSection('library');
    clipboardShelf.toast('Saved to prompt library');
}

async function addPromptToShelf(prompt) {
    await clipboardShelf.addText(prompt.text, 'prompt-library', {
        kind: 'prompt',
        title: prompt.title,
        tags: prompt.tags,
    });
    shelfState.selectedItemId = null;
    setActiveSection('shelf');
}

function createSurfaceScaffold(title, description) {
    const root = document.createElement('div');
    root.className = 'surface-view';
    const header = document.createElement('div');
    header.className = 'surface-header';
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    const descEl = document.createElement('p');
    descEl.textContent = description;
    header.appendChild(titleEl);
    header.appendChild(descEl);
    root.appendChild(header);
    return root;
}

function renderLibraryView() {
    libraryView.innerHTML = '';
    const root = createSurfaceScaffold('Library', 'Prompt assets stay editable, searchable, and ready to reuse.');
    const body = document.createElement('div');
    body.className = 'library-layout';

    const categoriesPane = document.createElement('div');
    categoriesPane.className = 'surface-side-column';
    const categoriesTitle = document.createElement('div');
    categoriesTitle.className = 'surface-side-title';
    categoriesTitle.textContent = 'Categories';
    categoriesPane.appendChild(categoriesTitle);

    getPromptCategories().forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `surface-filter-btn ${libraryState.category === category ? 'active' : ''}`;
        button.textContent = category === 'all' ? 'All prompts' : category;
        button.onclick = () => {
            libraryState.category = category;
            renderLibraryView();
        };
        categoriesPane.appendChild(button);
    });

    const listPane = document.createElement('div');
    listPane.className = 'surface-list-column';
    const searchInput = document.createElement('input');
    searchInput.className = 'surface-search-input';
    searchInput.placeholder = 'Search prompts';
    searchInput.value = libraryState.query;
    searchInput.oninput = (event) => {
        libraryState.query = event.target.value;
        renderLibraryView();
    };
    listPane.appendChild(searchInput);

    const promptList = document.createElement('div');
    promptList.className = 'surface-list';
    const prompts = getLibraryPrompts();
    const selectedPrompt = getSelectedPrompt();
    libraryState.selectedPromptId = selectedPrompt?.id || null;

    if (!prompts.length) {
        const empty = document.createElement('div');
        empty.className = 'surface-empty';
        empty.textContent = 'No prompts yet. Save a selection or create one from the current document.';
        promptList.appendChild(empty);
    } else {
        prompts.forEach((prompt) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `surface-list-item ${selectedPrompt?.id === prompt.id ? 'active' : ''}`;
            card.onclick = () => {
                libraryState.selectedPromptId = prompt.id;
                renderLibraryView();
            };
            card.innerHTML = `
                <div class="surface-list-title">${prompt.title}</div>
                <div class="surface-list-meta">${prompt.category || 'general'} · ${new Date(prompt.updatedAt).toLocaleDateString()}</div>
            `;
            promptList.appendChild(card);
        });
    }
    listPane.appendChild(promptList);

    const detailPane = document.createElement('div');
    detailPane.className = 'surface-detail-pane';
    if (selectedPrompt) {
        const titleInput = document.createElement('input');
        titleInput.className = 'surface-title-input';
        titleInput.value = selectedPrompt.title;
        titleInput.onchange = (event) => promptLibrary.updatePrompt(selectedPrompt.id, { title: event.target.value }).then(renderLibraryView);

        const bodyInput = document.createElement('textarea');
        bodyInput.className = 'surface-textarea prompt-editor';
        bodyInput.value = selectedPrompt.text;
        bodyInput.onchange = (event) => promptLibrary.updatePrompt(selectedPrompt.id, { text: event.target.value }).then(renderLibraryView);

        const categoryInput = document.createElement('input');
        categoryInput.className = 'surface-input';
        categoryInput.value = selectedPrompt.category || 'general';
        categoryInput.onchange = (event) => promptLibrary.updatePrompt(selectedPrompt.id, { category: event.target.value }).then(renderLibraryView);

        const tagsInput = document.createElement('input');
        tagsInput.className = 'surface-input';
        tagsInput.value = (selectedPrompt.tags || []).join(', ');
        tagsInput.onchange = (event) => promptLibrary.updatePrompt(selectedPrompt.id, { tags: event.target.value }).then(renderLibraryView);

        const notesInput = document.createElement('textarea');
        notesInput.className = 'surface-textarea notes';
        notesInput.value = selectedPrompt.notes || '';
        notesInput.onchange = (event) => promptLibrary.updatePrompt(selectedPrompt.id, { notes: event.target.value }).then(renderLibraryView);

        const actionRow = document.createElement('div');
        actionRow.className = 'surface-action-row';
        [
            ['Copy', async () => navigator.clipboard.writeText(selectedPrompt.text)],
            ['Duplicate', async () => { const duplicated = await promptLibrary.duplicatePrompt(selectedPrompt.id); libraryState.selectedPromptId = duplicated?.id || selectedPrompt.id; renderLibraryView(); }],
            ['Add to Shelf', async () => addPromptToShelf(selectedPrompt)],
            ['Delete', async () => { await promptLibrary.removePrompt(selectedPrompt.id); libraryState.selectedPromptId = null; renderLibraryView(); }],
        ].forEach(([label, handler]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'shell-action-btn';
            button.textContent = label;
            button.onclick = handler;
            actionRow.appendChild(button);
        });

        detailPane.appendChild(titleInput);
        detailPane.appendChild(actionRow);
        detailPane.appendChild(bodyInput);

        const metaGrid = document.createElement('div');
        metaGrid.className = 'surface-meta-grid';
        metaGrid.innerHTML = `
            <label class="surface-meta-field"><span>Category</span></label>
            <label class="surface-meta-field"><span>Tags</span></label>
        `;
        metaGrid.children[0].appendChild(categoryInput);
        metaGrid.children[1].appendChild(tagsInput);
        detailPane.appendChild(metaGrid);

        const notesField = document.createElement('label');
        notesField.className = 'surface-meta-field full';
        const notesLabel = document.createElement('span');
        notesLabel.textContent = 'Notes';
        notesField.appendChild(notesLabel);
        notesField.appendChild(notesInput);
        detailPane.appendChild(notesField);
    }

    body.appendChild(categoriesPane);
    body.appendChild(listPane);
    body.appendChild(detailPane);
    root.appendChild(body);
    libraryView.appendChild(root);
}

function renderShelfView() {
    shelfView.innerHTML = '';
    const root = createSurfaceScaffold('Shelf', 'Compact capture cards stay persistent, searchable, and ready to move back into work.');
    const body = document.createElement('div');
    body.className = 'library-layout shelf-layout';

    const listPane = document.createElement('div');
    listPane.className = 'surface-list-column';
    const searchInput = document.createElement('input');
    searchInput.className = 'surface-search-input';
    searchInput.placeholder = 'Search shelf items';
    searchInput.value = shelfState.query;
    searchInput.oninput = (event) => {
        shelfState.query = event.target.value;
        renderShelfView();
    };
    listPane.appendChild(searchInput);

    const ingestRow = document.createElement('div');
    ingestRow.className = 'surface-action-row';
    const addClipboardBtn = document.createElement('button');
    addClipboardBtn.type = 'button';
    addClipboardBtn.className = 'shell-action-btn';
    addClipboardBtn.textContent = 'Add Clipboard';
    addClipboardBtn.onclick = () => clipboardShelf.addFromClipboard();
    ingestRow.appendChild(addClipboardBtn);

    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.className = 'surface-file-input';
    imageInput.hidden = true;
    imageInput.onchange = async (event) => {
        const [file] = Array.from(event.target.files || []);
        if (file) {
            await clipboardShelf.addImage(file, { source: 'shelf-upload' });
            imageInput.value = '';
            renderShelfView();
        }
    };

    const addImageBtn = document.createElement('button');
    addImageBtn.type = 'button';
    addImageBtn.className = 'shell-action-btn';
    addImageBtn.textContent = 'Add Image';
    addImageBtn.onclick = () => imageInput.click();
    ingestRow.appendChild(addImageBtn);
    ingestRow.appendChild(imageInput);

    const ingestMeta = document.createElement('div');
    ingestMeta.className = 'surface-inline-meta';
    ingestMeta.textContent = 'Images are stored locally in the Shelf.';
    listPane.appendChild(ingestMeta);
    listPane.appendChild(ingestRow);

    const noteInput = document.createElement('textarea');
    noteInput.className = 'surface-textarea notes';
    noteInput.placeholder = 'Capture a note, snippet, or code block directly into the Shelf...';
    listPane.appendChild(noteInput);

    const saveNoteBtn = document.createElement('button');
    saveNoteBtn.type = 'button';
    saveNoteBtn.className = 'shell-action-btn';
    saveNoteBtn.textContent = 'Save Note';
    saveNoteBtn.onclick = async () => {
        if (!noteInput.value.trim()) {
            clipboardShelf.toast('Type a shelf note first', 'warn');
            return;
        }
        await clipboardShelf.addText(noteInput.value, 'shelf-note');
        noteInput.value = '';
        renderShelfView();
    };
    listPane.appendChild(saveNoteBtn);

    const itemList = document.createElement('div');
    itemList.className = 'surface-list';
    const items = getVisibleShelfItems();
    const selectedItem = getSelectedShelfItem();
    shelfState.selectedItemId = selectedItem?.id || null;

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'surface-empty';
        empty.textContent = 'No shelf items yet. Add clipboard text, selection snippets, or images.';
        itemList.appendChild(empty);
    } else {
        items.forEach((item) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `surface-list-item compact ${selectedItem?.id === item.id ? 'active' : ''}`;
            card.onclick = () => {
                shelfState.selectedItemId = item.id;
                renderShelfView();
            };
            card.innerHTML = `
                <div class="surface-list-title">${item.title}</div>
                <div class="surface-list-meta">${item.kind} · ${item.source}</div>
            `;
            itemList.appendChild(card);
        });
    }
    listPane.appendChild(itemList);

    const detailPane = document.createElement('div');
    detailPane.className = 'surface-detail-pane';
    if (selectedItem) {
        const title = document.createElement('h3');
        title.textContent = selectedItem.title;
        detailPane.appendChild(title);

        if (selectedItem.kind === 'image' && selectedItem.imagePath) {
            const image = document.createElement('img');
            image.className = 'surface-image-preview';
            image.src = selectedItem.imagePath.startsWith('data:')
                ? selectedItem.imagePath
                : encodeURI(convertFileSrc(selectedItem.imagePath));
            image.alt = selectedItem.title;
            detailPane.appendChild(image);
        }

        const pre = document.createElement(selectedItem.kind === 'code' ? 'pre' : 'textarea');
        pre.className = selectedItem.kind === 'code' ? 'surface-code-block' : 'surface-textarea notes';
        if (selectedItem.kind === 'code') {
            pre.textContent = selectedItem.text || '';
        } else {
            pre.value = selectedItem.text || '';
            pre.onchange = async (event) => {
                const item = clipboardShelf.items.find((entry) => entry.id === selectedItem.id);
                if (!item) return;
                item.text = event.target.value;
                item.updatedAt = new Date().toISOString();
                await clipboardShelf.save();
                renderShelfView();
            };
        }
        detailPane.appendChild(pre);

        const actionRow = document.createElement('div');
        actionRow.className = 'surface-action-row';
        [
            ['Copy', async () => clipboardShelf.copyItem(selectedItem)],
            ['Pin', async () => { await clipboardShelf.togglePin(selectedItem.id); renderShelfView(); }],
            ['To Library', async () => {
                const created = await promptLibrary.addPrompt(selectedItem.text || selectedItem.title, selectedItem.title, { tags: selectedItem.tags || [] });
                libraryState.selectedPromptId = created?.id || null;
                setActiveSection('library');
            }],
            ['Delete', async () => { await clipboardShelf.removeItem(selectedItem.id); shelfState.selectedItemId = null; renderShelfView(); }],
        ].forEach(([label, handler]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'shell-action-btn';
            button.textContent = label;
            button.onclick = handler;
            actionRow.appendChild(button);
        });
        detailPane.appendChild(actionRow);
    }

    body.appendChild(listPane);
    body.appendChild(detailPane);
    root.appendChild(body);
    shelfView.appendChild(root);
}

function renderSessionsView() {
    sessionsView.innerHTML = '';
    const root = createSurfaceScaffold('Sessions', 'Restore and inspect the active workspace state without turning sessions into a platform feature.');
    const body = document.createElement('div');
    body.className = 'surface-stack';

    const openTabsCard = document.createElement('div');
    openTabsCard.className = 'surface-card';
    openTabsCard.innerHTML = '<h3>Open Tabs</h3>';
    const openList = document.createElement('div');
    openList.className = 'surface-simple-list';
    tabs.getTabs().forEach((tab) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'surface-simple-item';
        row.textContent = tab.name;
        row.onclick = () => {
            setActiveSection('workspace');
            switchTab(tab.path);
        };
        openList.appendChild(row);
    });
    openTabsCard.appendChild(openList);
    body.appendChild(openTabsCard);

    const restoreCard = document.createElement('div');
    restoreCard.className = 'surface-card';
    restoreCard.innerHTML = `
        <h3>Session Restore</h3>
        <p>Workspace, temp tabs, and open file-backed tabs persist across restarts. Active path: ${currentFilePath || 'none'}.</p>
    `;
    body.appendChild(restoreCard);

    root.appendChild(body);
    sessionsView.appendChild(root);
}

function renderSearchView() {
    searchView.innerHTML = '';
    const root = createSurfaceScaffold('Search', 'Search is cross-asset and operational, not a separate analytics product.');
    const body = document.createElement('div');
    body.className = 'surface-stack';

    const toolbar = document.createElement('div');
    toolbar.className = 'surface-action-row';
    const queryInput = document.createElement('input');
    queryInput.className = 'surface-search-input grow';
    queryInput.placeholder = 'Search prompts, shelf, tabs, and files';
    queryInput.value = searchState.query;
    queryInput.oninput = (event) => {
        searchState.query = event.target.value;
        renderSearchView();
    };
    toolbar.appendChild(queryInput);

    const filter = document.createElement('select');
    filter.className = 'surface-select';
    ['all', 'prompt', 'shelf', 'tab', 'file'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        option.selected = searchState.filter === value;
        filter.appendChild(option);
    });
    filter.onchange = (event) => {
        searchState.filter = event.target.value;
        renderSearchView();
    };
    toolbar.appendChild(filter);
    body.appendChild(toolbar);

    const results = document.createElement('div');
    results.className = 'surface-list';
    getSearchResults().forEach((result) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'surface-list-item';
        item.innerHTML = `<div class="surface-list-title">${result.title}</div><div class="surface-list-meta">${result.type} · ${result.subtitle}</div>`;
        item.onclick = async () => {
            if (result.type === 'prompt') {
                libraryState.selectedPromptId = result.id;
                setActiveSection('library');
            } else if (result.type === 'shelf') {
                shelfState.selectedItemId = result.id;
                setActiveSection('shelf');
            } else if (result.type === 'tab') {
                setActiveSection('workspace');
                await switchTab(result.payload.path);
            } else if (result.type === 'file') {
                setActiveSection('workspace');
                await openPathWithUnsavedCheck(result.payload, 'open a searched file');
            }
        };
        results.appendChild(item);
    });

    if (!results.children.length) {
        const empty = document.createElement('div');
        empty.className = 'surface-empty';
        empty.textContent = searchState.query ? 'No matches.' : 'Start typing to search across active assets.';
        results.appendChild(empty);
    }

    body.appendChild(results);
    root.appendChild(body);
    searchView.appendChild(root);
}

function renderSettingsView() {
    settingsView.innerHTML = '';
    const root = createSurfaceScaffold('Settings', 'Keep settings focused on reliable editing, preview, restore, and output behavior.');
    const form = document.createElement('div');
    form.className = 'surface-meta-grid settings-grid';

    const fields = [
        ['Editor Font Size', 'editorFontSize', 'number'],
        ['XML Wrapper Tag', 'xmlWrapperTag', 'text'],
    ];

    fields.forEach(([label, key, type]) => {
        const field = document.createElement('label');
        field.className = 'surface-meta-field';
        const title = document.createElement('span');
        title.textContent = label;
        const input = document.createElement('input');
        input.className = 'surface-input';
        input.type = type;
        input.value = prefs.get(key);
        input.onchange = (event) => prefs.set(key, type === 'number' ? Number(event.target.value) : event.target.value);
        field.appendChild(title);
        field.appendChild(input);
        form.appendChild(field);
    });

    [
        ['syncScroll', 'Sync preview scroll'],
        ['renderFrontmatter', 'Render frontmatter cards'],
        ['alwaysReload', 'Always reload on external change'],
        ['promptOnExternalChange', 'Prompt when file changes externally'],
        ['includeFrontmatterInCopyLLM', 'Include frontmatter in LLM copy'],
    ].forEach(([key, label]) => {
        const field = document.createElement('label');
        field.className = 'surface-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!prefs.get(key);
        input.onchange = (event) => prefs.set(key, event.target.checked);
        const span = document.createElement('span');
        span.textContent = label;
        field.appendChild(input);
        field.appendChild(span);
        form.appendChild(field);
    });

    root.appendChild(form);
    settingsView.appendChild(root);
}

function refreshWorkbenchSurfaces() {
    refreshSidebarCollections();
    updateTopbar();
    if (activeSection === 'library') renderLibraryView();
    if (activeSection === 'shelf') renderShelfView();
    if (activeSection === 'sessions') renderSessionsView();
    if (activeSection === 'search') renderSearchView();
    if (activeSection === 'settings') renderSettingsView();
}

async function createTempTabWithContent(content, labelPrefix = null) {
    const path = `${TEMP_TAB_PREFIX}${Date.now()}`;
    const baseName = getNextTempTabName();
    const displayName = labelPrefix ? `${labelPrefix}: ${baseName}` : baseName;

    openDocuments.set(path, {
        content: content || '',
        lastSavedContent: content || '',
        isDirty: false,
        displayName,
        updatedAt: Date.now()
    });

    tabs.addTab(path, { name: displayName });
    await switchTab(path);
    await persistTempSession();
    await maybePromptTempTabCleanup();
    refreshWorkbenchSurfaces();
}

async function createTempTab() {
    await createTempTabWithContent('');
}

console.log('AgentPad: Main script initializing...');

// GLOBAL ERROR HANDLER
window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global Error Caught:', message, error);
    alert(`App Error: ${message}`);
};

// Initialize with a stable native title bar label until a file/folder is opened
setWindowTitle("AgentPad");

// Initialize Preferences
(async () => {
    await prefs.init();
    applySettings(prefs.getAll());
})();

function applySettings(settings) {
    // 1. Font Size
    document.documentElement.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`);

    // 2. Sync Scroll
    isSyncScrollEnabled = settings.syncScroll;

    // 3. Render Frontmatter
    if (isRenderFmEnabled !== settings.renderFrontmatter) {
        isRenderFmEnabled = settings.renderFrontmatter;
        forceRefresh();
    }
}

// Subscribe to changes
prefs.subscribe(applySettings);

// Drag & Drop (Native Fallback - Set up early)

// Drag & Drop (Native Fallback - Set up early)
document.addEventListener('dragover', (e) => {
    e.preventDefault(); // Crucial for allowing drop
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    console.log('Native Drop Event:', e);
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        console.log('Files dropped via native event:', e.dataTransfer.files);
        // Note: Native File object in Webview might not have path property exposed safely
        // We rely on Tauri event below, but this confirms the UI isn't blocking it.
    }
});

// DOM Elements
const shell = document.getElementById('app');
shell.className = 'app-shell';

const navRail = document.createElement('aside');
navRail.className = 'nav-rail';

const navBrand = document.createElement('div');
navBrand.className = 'nav-brand';
navBrand.innerHTML = `
    <div class="nav-brand-mark">A</div>
    <div class="nav-brand-copy">
        <div class="nav-brand-title">AgentPad</div>
        <div class="nav-brand-subtitle">Workbench v1</div>
    </div>
`;
navRail.appendChild(navBrand);

const sectionOrder = ['workspace', 'library', 'shelf', 'sessions', 'search', 'settings'];
const sectionLabels = {
    workspace: 'Workspace',
    library: 'Library',
    shelf: 'Shelf',
    sessions: 'Sessions',
    search: 'Search',
    settings: 'Settings',
};
let activeSection = 'workspace';
const navButtons = new Map();

const shellMain = document.createElement('div');
shellMain.className = 'shell-main';

const shellTopbar = document.createElement('header');
shellTopbar.className = 'shell-topbar';

const shellTopbarTitle = document.createElement('div');
shellTopbarTitle.className = 'shell-topbar-title';

const shellTopbarMeta = document.createElement('div');
shellTopbarMeta.className = 'shell-topbar-meta';

const shellTopbarActions = document.createElement('div');
shellTopbarActions.className = 'shell-topbar-actions';

shellTopbar.appendChild(shellTopbarTitle);
shellTopbar.appendChild(shellTopbarMeta);
shellTopbar.appendChild(shellTopbarActions);

const contentDeck = document.createElement('div');
contentDeck.className = 'content-deck';

const app = document.createElement('div');
app.className = 'content-view workspace-layout active';
contentDeck.appendChild(app);

const libraryView = document.createElement('section');
libraryView.className = 'content-view section-view';
contentDeck.appendChild(libraryView);

const shelfView = document.createElement('section');
shelfView.className = 'content-view section-view';
contentDeck.appendChild(shelfView);

const sessionsView = document.createElement('section');
sessionsView.className = 'content-view section-view';
contentDeck.appendChild(sessionsView);

const searchView = document.createElement('section');
searchView.className = 'content-view section-view';
contentDeck.appendChild(searchView);

const settingsView = document.createElement('section');
settingsView.className = 'content-view section-view';
contentDeck.appendChild(settingsView);

shellMain.appendChild(shellTopbar);
shellMain.appendChild(contentDeck);
shell.appendChild(navRail);
shell.appendChild(shellMain);

const editorContainer = document.createElement('div');
editorContainer.className = 'editor-pane';

// Init Tabs
tabs.init(editorContainer, (path) => switchTab(path), (path) => closeTab(path));

const workspaceToolbar = document.createElement('div');
workspaceToolbar.className = 'workspace-toolbar';
workspaceToolbar.setAttribute('data-tauri-drag-region', 'false');

const workspaceModeGroup = document.createElement('div');
workspaceModeGroup.className = 'workspace-toolbar-group workspace-toolbar-group--segmented';

const workspaceActionGroup = document.createElement('div');
workspaceActionGroup.className = 'workspace-toolbar-group';

const previewContainer = document.createElement('div');
previewContainer.className = 'preview-pane';
const markdownBody = document.createElement('div');
markdownBody.className = 'markdown-body';
previewContainer.appendChild(markdownBody);

const resizer = document.createElement('div');
resizer.className = 'resizer';

// Sidebar
const sidebarContainer = document.createElement('div');
sidebarContainer.className = 'sidebar-pane';

const sidebarDragHandle = document.createElement('div');
sidebarDragHandle.className = 'sidebar-drag-handle';
sidebarDragHandle.setAttribute('data-tauri-drag-region', 'true');
sidebarContainer.appendChild(sidebarDragHandle);

// Hide sidebar by default until a folder is opened
sidebarContainer.style.display = 'none';

const sidebarResizer = document.createElement('div');
sidebarResizer.className = 'sidebar-resizer';
sidebarResizer.style.display = 'none';

app.appendChild(sidebarContainer);
app.appendChild(sidebarResizer);
app.appendChild(editorContainer);
app.appendChild(resizer);
app.appendChild(previewContainer);

// Drop Zone
const dropZone = document.createElement('div');
dropZone.className = 'drop-zone';
dropZone.innerHTML = `
    <div class="drop-zone-content">
        <svg class="drop-zone-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        <div class="drop-zone-text">Drop markdown or YAML file to open</div>
    </div>
`;
app.appendChild(dropZone);

// Drag Logic (Resizer)
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerWidth = app.offsetWidth;
    const x = e.clientX;
    const percentage = (x / containerWidth) * 100;
    if (percentage > 10 && percentage < 90) {
        editorContainer.style.width = `${percentage}%`;
        previewContainer.style.width = `${100 - percentage}%`;
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const containerWidth = app.offsetWidth;
        const currentWidth = editorContainer.offsetWidth;
        const percentage = (currentWidth / containerWidth) * 100;
        localStorage.setItem(SPLIT_RATIO_KEY, percentage.toFixed(2));
    }
});
// Editor Resizer Logic
const openBtn = document.createElement('button');
openBtn.textContent = 'Open';
openBtn.className = 'workspace-toolbar-btn';
openBtn.onclick = openFile;
openBtn.title = 'Open File (Cmd+O)';

const newTabBtn = document.createElement('button');
newTabBtn.textContent = 'New Tab';
newTabBtn.className = 'workspace-toolbar-btn';
newTabBtn.onclick = createTempTab;
newTabBtn.title = 'New temporary tab (Cmd+T)';

const previewBtn = document.createElement('button');
previewBtn.textContent = 'Split';
previewBtn.className = 'workspace-toolbar-btn workspace-toolbar-btn--mode';
previewBtn.onclick = () => setViewMode(VIEW_MODES.SPLIT, { ratio: 25 });
previewBtn.title = 'Split View (Cmd+P)';

const codeBtn = document.createElement('button');
codeBtn.textContent = 'Source';
codeBtn.className = 'workspace-toolbar-btn workspace-toolbar-btn--mode';
codeBtn.onclick = () => setViewMode(VIEW_MODES.EDITOR);
codeBtn.title = 'Source View (Cmd+E)';

const shelfBtn = document.createElement('button');
shelfBtn.textContent = 'Shelf Panel';
shelfBtn.className = 'workspace-toolbar-btn';
shelfBtn.title = 'Toggle shelf panel (Cmd+Shift+K). Add clipboard: Cmd+Shift+V, selection: Cmd+Shift+Y, search: Cmd+Shift+J, save prompt: Cmd+Shift+G';
shelfBtn.onclick = () => clipboardShelf.toggle();

workspaceModeGroup.appendChild(codeBtn);
workspaceModeGroup.appendChild(previewBtn);
workspaceActionGroup.appendChild(openBtn);
workspaceActionGroup.appendChild(newTabBtn);
workspaceActionGroup.appendChild(shelfBtn);
workspaceToolbar.appendChild(workspaceModeGroup);
workspaceToolbar.appendChild(workspaceActionGroup);
editorContainer.appendChild(workspaceToolbar);

const sectionViews = {
    workspace: app,
    library: libraryView,
    shelf: shelfView,
    sessions: sessionsView,
    search: searchView,
    settings: settingsView,
};

let libraryState = { query: '', category: 'all', selectedPromptId: null };
let shelfState = { query: '', selectedItemId: null };
let searchState = { query: '', filter: 'all' };

function renderNavRail() {
    Array.from(navRail.querySelectorAll('.nav-button')).forEach((node) => node.remove());
    sectionOrder.forEach((section) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `nav-button ${activeSection === section ? 'active' : ''}`;
        button.textContent = sectionLabels[section];
        button.onclick = () => setActiveSection(section);
        navRail.appendChild(button);
        navButtons.set(section, button);
    });
}

function updateTopbar() {
    const currentDoc = getActiveDocument();
    const activeLabel = sectionLabels[activeSection];
    shellTopbarTitle.textContent = activeLabel;

    if (activeSection === 'workspace') {
        shellTopbarMeta.textContent = currentDoc
            ? `${currentDoc.displayName || UNTITLED_TITLE} · ${viewMode}`
            : 'Open, edit, preview, and stage working documents.';
    } else if (activeSection === 'library') {
        shellTopbarMeta.textContent = 'Reusable prompts and assets for active work.';
    } else if (activeSection === 'shelf') {
        shellTopbarMeta.textContent = 'Persistent capture and staging space for text, code, and images.';
    } else if (activeSection === 'sessions') {
        shellTopbarMeta.textContent = 'Current workspace state and recently restored tabs.';
    } else if (activeSection === 'search') {
        shellTopbarMeta.textContent = 'Unified search across prompts, shelf items, tabs, and recent files.';
    } else {
        shellTopbarMeta.textContent = 'Core workbench settings and defaults.';
    }

    shellTopbarActions.innerHTML = '';
    const actionConfigs = {
        workspace: [
            { label: 'Library', onClick: () => setActiveSection('library') },
            { label: 'Shelf', onClick: () => setActiveSection('shelf') },
            { label: 'Search', onClick: () => setActiveSection('search') },
        ],
        library: [
            { label: 'New Prompt', onClick: () => createPromptFromCurrent() },
            { label: 'Shelf', onClick: () => setActiveSection('shelf') },
        ],
        shelf: [
            { label: 'Add Clipboard', onClick: () => clipboardShelf.addFromClipboard() },
            { label: 'Workspace', onClick: () => setActiveSection('workspace') },
        ],
        sessions: [
            { label: 'Workspace', onClick: () => setActiveSection('workspace') },
        ],
        search: [
            { label: 'Library', onClick: () => setActiveSection('library') },
            { label: 'Shelf', onClick: () => setActiveSection('shelf') },
        ],
        settings: [
            { label: 'Workspace', onClick: () => setActiveSection('workspace') },
        ],
    };

    (actionConfigs[activeSection] || []).forEach(({ label, onClick }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shell-action-btn';
        button.textContent = label;
        button.onclick = onClick;
        shellTopbarActions.appendChild(button);
    });
}

function setActiveSection(section) {
    activeSection = section;
    Object.entries(sectionViews).forEach(([key, view]) => {
        view.classList.toggle('active', key === section);
    });
    renderNavRail();
    updateTopbar();
    renderLibraryView();
    renderShelfView();
    renderSessionsView();
    renderSearchView();
    renderSettingsView();
}

renderNavRail();

// State (moved to top)
const VIEW_MODES = {
    EDITOR: 'editor',
    SPLIT: 'split',
    PREVIEW: 'preview'
};
// viewMode init
if (!viewMode) viewMode = VIEW_MODES.EDITOR; // Ensure set if not above

// Thresholds
const THRESHOLD_LARGE = 500 * 1024; // 500KB
const THRESHOLD_HUGE = 1024 * 1024; // 1MB
const DEBOUNCE_NORMAL = 250;
const DEBOUNCE_SLOW = 750;

// Paused Indicator
const pausedIndicator = document.createElement('div');
// app is already defined at top scope


pausedIndicator.className = 'paused-indicator';
pausedIndicator.textContent = 'Preview Paused (Cmd+R to refresh)';
app.appendChild(pausedIndicator);

// Worker Setup
const worker = new Worker(new URL('./render.worker.js', import.meta.url), {
    type: 'module'
});

worker.onmessage = (e) => {
    const dirtyHtml = e.data;
    const cleanHtml = DOMPurify.sanitize(dirtyHtml);
    markdownBody.innerHTML = cleanHtml;
};

// Token Worker
const tokenWorker = new Worker(new URL('./token.worker.js', import.meta.url), {
    type: 'module'
});

tokenWorker.onmessage = (e) => {
    if (e.data.count !== undefined) {
        statusBar.updateTokens(e.data.count, e.data.words);
    } else if (e.data.error) {
        console.error(`Token Worker Error: ${e.data.error}`);
    }
};

// Auto-save Logic
// Auto-save Logic
async function performAutoSave(content) {
    if (currentFilePath && !isScratchpadPath(currentFilePath)) {
        try {
            isSaving = true;
            await writeTextFile(currentFilePath, content);
            console.log('Auto-saved to', currentFilePath);

            // Update mtime to prevent watcher trigger
            try {
                const stats = await stat(currentFilePath);
                lastKnownMtime = stats.mtime ? new Date(stats.mtime).getTime() : Date.now();
            } catch (e) { }

            // Sync reference
            lastSavedContent = content;
            markCurrentDocumentSaved(content);

        } catch (err) {
            console.error('Auto-save failed:', err);
        } finally {
            setTimeout(() => {
                isSaving = false;
            }, 500);
        }
    }
}

// Editor Setup
const editor = createEditor(editorContainer, "", (newContent) => {
    const contentLength = newContent.length;
    const isHugeDocument = contentLength > THRESHOLD_HUGE;

    updateDirtyState(newContent);

    // Adaptive Logic
    if (isHugeDocument && !isPreviewPaused) {
        isPreviewPaused = true;
        pausedIndicator.classList.add('visible');
    } else if (!isHugeDocument && isPreviewPaused) {
        isPreviewPaused = false;
        pausedIndicator.classList.remove('visible');
    }

    const delay = (contentLength > THRESHOLD_LARGE || isHugeDocument) ? DEBOUNCE_SLOW : DEBOUNCE_NORMAL;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        // Keep preview paused for huge docs, but continue autosave and metrics.
        if (!isHugeDocument && viewMode !== VIEW_MODES.EDITOR) {
            postRenderUpdate(newContent);
        }

        if (isScratchpadPath(currentFilePath) && newContent !== lastSavedContent) {
            persistScratchpad(newContent);
        } else if (isTempTabPath(currentFilePath)) {
            persistTempSession();
        } else if (currentFilePath && newContent !== lastSavedContent) {
            performAutoSave(newContent);
        }

        statusBar.updateTokens('...');
        tokenWorker.postMessage(newContent);
    }, delay);
}, (line, col) => {
    statusBar.updateCursor(line, col);
}, (event, view) => {
    // 1. Image Handling
    const items = event.clipboardData && event.clipboardData.items;
    let hasImage = false;
    if (items) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    handleImagePaste(view, file);
                    hasImage = true;
                }
            }
        }
    }

    if (hasImage) {
        return true; // Prevent default paste
    }

    return false; // Allow default paste
}, {
    spellcheck: prefs.get('spellcheckEnabled'),
    theme: prefs.get('theme')
});

// Init// Status Bar
statusBar.init(document.body, () => {
    // Sidebar Toggle
    if (sidebarContainer.style.display === 'none') {
        sidebarContainer.style.display = 'block';
        sidebarResizer.style.display = 'block';
        app.classList.add('has-sidebar');
    } else {
        sidebarContainer.style.display = 'none';
        sidebarResizer.style.display = 'none';
        app.classList.remove('has-sidebar');
    }
}, () => {
    // Search Toggle
    toggleSearch(editor);
});

// Show Onboarding
showOnboarding();

// Initialize scratchpad + clipboard shelf
(async () => {
    clipboardShelf.setSelectionProvider(() => {
        const sel = editor.state.selection.main;
        if (sel.from === sel.to) return '';
        return editor.state.doc.sliceString(sel.from, sel.to);
    });
    await clipboardShelf.init(document.body);
    await promptLibrary.init();
    await ensureScratchpadTab();

    const session = await loadTempSession();
    for (const fileTab of session.fileTabs || []) {
        try {
            const content = await readTextFile(fileTab.path);
            openDocuments.set(fileTab.path, {
                content,
                lastSavedContent: content,
                isDirty: false,
                displayName: fileTab.displayName || getBasename(fileTab.path),
                updatedAt: Date.now()
            });
            tabs.addTab(fileTab.path, {
                name: fileTab.displayName || getBasename(fileTab.path),
                closable: true,
                activate: false
            });
        } catch (err) {
            console.warn('Skipping missing session file tab:', fileTab.path, err);
        }
    }

    for (const tab of session.tempTabs) {
        openDocuments.set(tab.path, {
            content: tab.content || '',
            lastSavedContent: tab.lastSavedContent || '',
            isDirty: !!tab.isDirty,
            displayName: tab.displayName || getNextTempTabName(),
            updatedAt: tab.updatedAt || Date.now()
        });
        tabs.addTab(tab.path, {
            name: tab.displayName || getBasename(tab.path),
            closable: true,
            activate: false
        });
        tabs.setDirty(tab.path, !!tab.isDirty);
    }

    const restorePath = session.activePath && openDocuments.has(session.activePath)
        ? session.activePath
        : SCRATCH_TAB_PATH;
    await switchTab(restorePath);
    await maybePromptTempTabCleanup();
    await persistTempSession();
    refreshSidebarCollections();
    postRenderUpdate(editor.state.doc.toString());
    setActiveSection('workspace');
})();


// Scroll Logic (Smooth)
let ignoreSource = null;
let ignoreTimer = null;

// Sync Scroll Logic
// Sync Scroll Logic
function handleSyncScroll(source, target) {
    if (!isSyncScrollEnabled) return;
    if (ignoreSource && ignoreSource !== source) return;

    ignoreSource = source;

    // Calculate percentage
    // Guard against Divide by Zero
    const maxScroll = source.scrollHeight - source.clientHeight;
    if (maxScroll <= 0) return;

    const percentage = source.scrollTop / maxScroll;
    const targetMaxScroll = target.scrollHeight - target.clientHeight;

    target.scrollTop = percentage * targetMaxScroll;

    // Debounce clearing the ignore flag
    if (ignoreTimer) clearTimeout(ignoreTimer);
    ignoreTimer = setTimeout(() => {
        if (ignoreSource === source) {
            ignoreSource = null;
        }
    }, 100);
}

// Attach listeners
editor.scrollDOM.addEventListener('scroll', () => handleSyncScroll(editor.scrollDOM, markdownBody.parentElement));
previewContainer.addEventListener('scroll', () => handleSyncScroll(markdownBody.parentElement, editor.scrollDOM));

// Sidebar Logic
sidebar = new Sidebar(sidebarContainer, {
    onFileSelect: async (path) => {
        await openPathWithUnsavedCheck(path, 'open a file from the sidebar');
    },
    onClipSelect: async (clip) => {
        await createTempTabWithContent(clip.text || '', 'Clip');
    },
    onPromptSelect: async (prompt) => {
        await createTempTabWithContent(prompt.text || '', 'Prompt');
    },
    onTempTabSelect: async (path) => {
        await switchTab(path);
    }
});

clipboardShelf.onChange(() => {
    refreshWorkbenchSurfaces();
});

promptLibrary.onChange(() => {
    refreshWorkbenchSurfaces();
});

refreshSidebarCollections();

// Sidebar Resizer
let isSidebarResizing = false;
sidebarResizer.addEventListener('mousedown', (e) => {
    isSidebarResizing = true;
    sidebarResizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (isSidebarResizing) {
        let newWidth = e.clientX;
        if (newWidth < 150) newWidth = 150; // min width
        if (newWidth > 400) newWidth = 400; // max width
        sidebarContainer.style.width = `${newWidth}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (isSidebarResizing) {
        isSidebarResizing = false;
        sidebarResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // TODO: Save width to prefs
    }
});

// -------------------------------------------------------------------------
// CRITICAL: Tauri Event Listeners (Registered after editor/worker created)
// -------------------------------------------------------------------------

// Register all event listeners asynchronously
(async function registerEventListeners() {
    try {
        console.log('Registering Tauri event listeners...');

        if (!isTauriRuntime) {
            console.log('Running without Tauri runtime; native event listeners disabled.');
            await setWindowTitle('AgentPad');
            return;
        }

        // Menu Events
        await listen('menu-open', () => openFile());
        await listen('menu-save', () => saveFile());
        await listen('menu-save-as', () => saveFile(true));
        await listen('menu-open-recent', () => showRecentFilesModal());
        await listen('menu-close-recent', () => clearRecentFiles());
        await listen('file-opened-from-launch', (e) => openPathWithUnsavedCheck(e.payload, 'open the launched file'));

        await listen('menu-open-folder', async () => {
            try {
                const selected = await open({
                    directory: true,
                    multiple: false
                });

                if (selected) {
                    // Open Folder Mode
                    await sidebar.setRoot(selected);
                    refreshSidebarCollections();

                    // Show Sidebar
                    sidebarContainer.style.display = 'block';
                    sidebarResizer.style.display = 'block';
                    app.classList.add('has-sidebar');

                    await setWindowTitle(selected); // Folder Name
                }
            } catch (err) {
                console.error("Failed to open folder", err);
            }
        });

        await listen('menu-new', async () => {
            if (!(await ensureCanDiscardUnsavedChanges('create a new document'))) return;

            await ensureScratchpadTab();
            const scratchDoc = openDocuments.get(SCRATCH_TAB_PATH);
            if (scratchDoc) {
                scratchDoc.content = '';
                scratchDoc.lastSavedContent = '';
                scratchDoc.isDirty = false;
                tabs.setDirty(SCRATCH_TAB_PATH, false);
            }

            await switchTab(SCRATCH_TAB_PATH);
            editor.dispatch({
                changes: { from: 0, to: editor.state.doc.length, insert: "" }
            });
            lastSavedContent = '';
            currentFilePath = SCRATCH_TAB_PATH;
            postRenderUpdate('');
            await persistScratchpad('', true);
            await setWindowTitle(UNTITLED_TITLE);
            await persistTempSession();
        });

        await listen('toggle-sync-scroll', (e) => {
            // Legacy menu handler - update prefs instead which triggers subscriber
            prefs.set('syncScroll', e.payload);
        });

        await listen('toggle-frontmatter', (e) => {
            // Legacy menu handler
            prefs.set('renderFrontmatter', e.payload);
        });

        await listen('menu-preferences', () => {
            prefsUI.toggle();
        });

        await listen('menu-copy-llm', async () => {
            const sel = editor.state.selection.main;
            const hasSelection = sel.from !== sel.to;
            let content;

            if (hasSelection) {
                // Copy selection only — no frontmatter stripping
                content = editor.state.doc.sliceString(sel.from, sel.to);
            } else {
                // Copy full document
                content = editor.state.doc.toString();
                // Strip YAML Frontmatter unless preference says to include it
                if (!prefs.get('includeFrontmatterInCopyLLM')) {
                    content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
                }
            }

            const tag = prefs.get('xmlWrapperTag') || 'document';
            const wrapped = `<${tag}>\n${content}\n</${tag}>`;
            try {
                await navigator.clipboard.writeText(wrapped);
                alert("Copied wrapped content to clipboard!");
            } catch (err) {
                console.error('Failed to copy', err);
                alert("Failed to copy to clipboard.");
            }
        });

        await listen('menu-copy-rich-text', async () => {
            try {
                // 1. Get current HTML
                // We rely on markdownBody being up to date.
                // If in editor mode, we might want to force a render properly, 
                // but usually the worker handles it.
                // Let's ensure it's up to date with a quick re-render request? 
                // (Worker is async, so we might read stale data if we just typed).
                // For now, assume it's "fresh enough" or user is in Preview mode.

                // For now, assume it's "fresh enough" or user is in Preview mode.

                let htmlContent = markdownBody.innerHTML;

                // Sanitization: Strip Frontmatter
                if (prefs.get('sanitizationStripFrontmatter')) {
                    const clone = markdownBody.cloneNode(true);
                    const fm = clone.querySelector('.front-matter');
                    if (fm) {
                        fm.remove();
                        htmlContent = clone.innerHTML;
                    }
                }

                // Append Styles if requested (for Rich Text, we usually inline or put in head? 
                // Clipboard 'text/html' accepts full HTML document with head/body)
                if (prefs.get('exportIncludeTheme')) {
                    const style = `
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
                        pre { background: #f6f8fa; padding: 12px; border-radius: 6px; }
                        code { background: rgba(27,31,35,0.05); padding: 0.2em 0.4em; border-radius: 3px; }
                        table { border-collapse: collapse; }
                        th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
                        blockquote { border-left: 4px solid #dfe2e5; padding-left: 1em; color: #6a737d; }
                    `;
                    // Wrap in full structure for clipboard
                    htmlContent = `<!DOCTYPE html><html><head><style>${style}</style></head><body>${htmlContent}</body></html>`;
                }

                const plainText = editor.state.doc.toString();

                const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
                const textBlob = new Blob([plainText], { type: 'text/plain' });

                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': htmlBlob,
                        'text/plain': textBlob
                    })
                ]);
                alert("Copied as Rich Text!");
            } catch (err) {
                console.error("Failed to copy rich text", err);
                alert("Failed to copy as Rich Text.");
            }
        });

        await listen('menu-export-pdf', async () => {
            try {
                // Ensure preview HTML is up to date before printing.
                postRenderUpdate(editor.state.doc.toString());
                await new Promise(resolve => setTimeout(resolve, 40));
                await invoke('plugin:webview|print');
            } catch (err) {
                console.error('Native print failed, falling back to window.print():', err);
                try {
                    window.print();
                } catch (fallbackErr) {
                    console.error('window.print() failed:', fallbackErr);
                    alert('Export to PDF failed. Try Export to HTML and print from browser.');
                }
            }
        });

        await listen('menu-export-docx', async () => {
            const content = editor.state.doc.toString();
            await exportToDocx(content, currentFilePath);
        });

        const applyTheme = () => {
            const theme = prefs.get('theme');
            let isDark = true;

            if (theme === 'system') {
                isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            } else if (theme === 'light') {
                isDark = false;
            } else {
                isDark = true;
            }

            if (isDark) {
                document.body.classList.remove('light-mode');
            } else {
                document.body.classList.add('light-mode');
            }

            if (editor) {
                setEditorTheme(editor, isDark);
            }
        };

        // Theme Listeners
        await listen('menu-theme-system', async () => {
            await prefs.set('theme', 'system');
            applyTheme();
        });
        await listen('menu-theme-light', async () => {
            await prefs.set('theme', 'light');
            applyTheme();
        });
        await listen('menu-theme-dark', async () => {
            await prefs.set('theme', 'dark');
            applyTheme();
        });

        // Initialize Theme
        applyTheme();

        // System Preference Listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (prefs.get('theme') === 'system') applyTheme();
        });

        await listen('menu-export-html', async () => {
            try {
                const selected = await save({
                    filters: [{ name: 'HTML Document', extensions: ['html'] }]
                });

                if (!selected) return;

                const title = currentFilePath ? currentFilePath.split('/').pop() : "Untitled";

                let bodyContent = markdownBody.innerHTML;

                // Sanitization: Strip Frontmatter
                if (prefs.get('sanitizationStripFrontmatter')) {
                    const clone = markdownBody.cloneNode(true);
                    const fm = clone.querySelector('.front-matter');
                    if (fm) {
                        fm.remove();
                        bodyContent = clone.innerHTML;
                    }
                }

                // Minimal styling for the exported HTML
                let style = '';
                if (prefs.get('exportIncludeTheme')) {
                    style = `
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; color: #24292e; }
                    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
                    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; background: rgba(27,31,35,0.05); padding: 0.2em 0.4em; border-radius: 3px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
                    th { background-color: #f6f8fa; }
                    blockquote { border-left: 0.25em solid #dfe2e5; color: #6a737d; padding-left: 1em; margin: 0; }
                    a { color: #0366d6; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                `;
                }

                const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${style}</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

                await writeTextFile(selected, html);
                alert("Exported to HTML successfully!");

            } catch (e) {
                console.error("Export HTML failed", e);
                alert("Failed to export HTML.");
            }
        });
        // File Watcher Event
        await listen('file-changed', async (e) => {
            const changedPath = e.payload;
            if (changedPath !== currentFilePath) return;

            // 1. Check Latch
            if (isSaving) {
                console.log('Ignored file-changed event due to self-save');
                return;
            }

            // 2. Check Timestamp (mtime)
            try {
                const stats = await stat(currentFilePath);
                const currentMtime = stats.mtime ? new Date(stats.mtime).getTime() : 0;

                // Allow small drift?
                if (currentMtime <= lastKnownMtime) {
                    console.log('Ignored file-changed: mtime not newer', currentMtime, lastKnownMtime);
                    return;
                }
            } catch (err) {
                console.warn('Failed to stat file during watch event', err);
            }

            // "Always Reload" preference
            if (prefs.get('alwaysReload')) {
                await loadFile(currentFilePath);
                return;
            }

            // Silent mode: ignore external change notifications/prompts.
            if (!prefs.get('promptOnExternalChange')) {
                return;
            }

            // Prompt using non-blocking UI
            const currentContent = editor.state.doc.toString();
            const activeDoc = getActiveDocument();
            const hasUnsavedChanges = activeDoc ? currentContent !== activeDoc.lastSavedContent : currentContent !== lastSavedContent;
            reloadPromptUI.show(changedPath, async () => {
                await loadFile(currentFilePath);
            }, hasUnsavedChanges);
        });

        // Drag & Drop Events (Tauri v2)
        await listen('tauri://drag-drop', async (event) => {
            console.log('✓ Tauri Drag-Drop Event:', event);
            // v2 payload might be { paths: [], position: {} } or just paths
            const payload = event.payload;
            const paths = payload.paths || payload;

            dropZone.classList.remove('active');

            if (Array.isArray(paths) && paths.length > 0) {
                const path = paths[0];
                console.log('Processing dropped file:', path);
                if (/\.(md|markdown|txt|ya?ml)$/i.test(path)) {
                    await openPathWithUnsavedCheck(path, 'open the dropped file');
                } else {
                    alert("File type not supported. Please drop a markdown, text, or YAML file.");
                }
            } else {
                console.warn('Drag-drop event received but no paths found');
            }
        });

        await listen('tauri://drag-enter', () => {
            dropZone.classList.add('active');
        });

        await listen('tauri://drag-leave', () => {
            dropZone.classList.remove('active');
        });

        console.log('✓ All event listeners registered successfully');

        // Check for launch file after listeners are registered
        const launchPath = await invoke('get_launch_file');
        if (launchPath) {
            console.log('Opening launch file:', launchPath);
            await openPathWithUnsavedCheck(launchPath, 'open the launch file');
        } else if (!currentFilePath || !openDocuments.has(currentFilePath)) {
            // Set default title if no file loaded
            await setWindowTitle(UNTITLED_TITLE);
        }
    } catch (err) {
        console.error('Failed to register event listeners:', err);
        alert(`Failed to initialize app: ${err.message}`);
    }
})();

function setViewMode(mode, options = {}) {
    const normalizedMode = mode === VIEW_MODES.PREVIEW ? VIEW_MODES.SPLIT : mode;
    viewMode = normalizedMode;
    localStorage.setItem(VIEW_MODE_KEY, normalizedMode);

    // Reset Classes
    app.classList.remove('split-mode');
    previewContainer.classList.remove('visible', 'single-mode');
    codeBtn.classList.remove('active');
    previewBtn.classList.remove('active');

    switch (normalizedMode) {
        case VIEW_MODES.EDITOR:
            editorContainer.style.display = 'block';
            editorContainer.style.width = '';
            previewContainer.style.width = '';
            codeBtn.classList.add('active');
            editor.focus();
            break;
        case VIEW_MODES.SPLIT:
            app.classList.add('split-mode');
            editorContainer.style.display = 'block';

            // Restore saved ratio or default to 50%
            const savedRatio = localStorage.getItem(SPLIT_RATIO_KEY);
            const ratio = typeof options.ratio === 'number'
                ? options.ratio
                : (savedRatio ? parseFloat(savedRatio) : 50);

            editorContainer.style.width = `${ratio}%`;
            previewContainer.style.width = `${100 - ratio}%`;

            previewContainer.classList.add('visible');
            previewBtn.classList.add('active');
            // Force render on enter split
            postRenderUpdate(editor.state.doc.toString());
            editor.focus();
            break;
    }
}

function forceRefresh() {
    const content = editor.state.doc.toString();
    postRenderUpdate(content);
    // Also trigger save if huge
    performAutoSave(content);
}

// Recent Files Logic
function getRecentFiles() {
    try {
        const stored = localStorage.getItem(RECENT_FILES_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return parsed.filter(path => !isVirtualTabPath(path));
    } catch {
        return [];
    }
}

function addToRecent(path) {
    const recent = getRecentFiles();
    const updated = [path, ...recent.filter(p => p !== path)].slice(0, MAX_RECENT_FILES);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated));
    refreshSidebarCollections();
}

// Init View Mode from Storage
const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
if (savedViewMode) {
    setViewMode(savedViewMode === VIEW_MODES.PREVIEW ? VIEW_MODES.SPLIT : savedViewMode);
}

function clearRecentFiles() {
    localStorage.removeItem(RECENT_FILES_KEY);
    refreshSidebarCollections();
    // If modal is open, refresh it (close it or show empty state)
    const existingModal = document.getElementById('recent-files-modal');
    if (existingModal) {
        existingModal.remove();
        alert("Recent files history cleared.");
    }
}

function showRecentFilesModal() {
    const existingModal = document.getElementById('recent-files-modal');
    if (existingModal) existingModal.remove();

    const recent = getRecentFiles();
    if (recent.length === 0) {
        alert("No recent files.");
        return;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'recent-files-modal';
    modalOverlay.className = 'modal-overlay';

    // Close on click outside
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) modalOverlay.remove();
    };

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const title = document.createElement('h3');
    title.textContent = 'Open Recent';
    modalContent.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'recent-file-list';

    recent.forEach(path => {
        const li = document.createElement('li');
        li.textContent = path;
        li.onclick = async () => {
            modalOverlay.remove();
            await openPathWithUnsavedCheck(path, 'open a recent file');
        };
        list.appendChild(li);
    });

    modalContent.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    closeBtn.className = 'btn secondary';
    closeBtn.style.marginTop = '1rem';
    closeBtn.onclick = () => modalOverlay.remove();
    modalContent.appendChild(closeBtn);

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
}

async function startWatching(path) {
    if (!isTauriRuntime) return;
    try {
        await invoke('watch_file', { path });
    } catch (e) {
        console.error("Failed to start watcher", e);
    }
}

// --- Tab Management ---

async function switchTab(path) {
    if (path === currentFilePath) return;

    // Save current state if we have a file open
    if (currentFilePath && openDocuments.has(currentFilePath)) {
        const doc = openDocuments.get(currentFilePath);
        const currentContent = editor.state.doc.toString();
        doc.content = currentContent;
        doc.isDirty = currentContent !== doc.lastSavedContent;
        doc.updatedAt = Date.now();
        tabs.setDirty(currentFilePath, doc.isDirty);
        // doc.scrollTop = ... (CodeMirror scroll state is complex, omit for MVP)
    }

    // Load new state
    if (openDocuments.has(path)) {
        currentFilePath = path;
        tabs.setActive(path);
        const doc = openDocuments.get(path);

        if (isVirtualTabPath(path) && typeof doc.content === 'string' && doc.content.includes('data:image/')) {
            const migratedContent = await migrateInlineDataImages(doc.content);
            if (migratedContent !== doc.content) {
                doc.content = migratedContent;
                doc.lastSavedContent = migratedContent;
                doc.isDirty = false;
                tabs.setDirty(path, false);
                if (isScratchpadPath(path)) {
                    await persistScratchpad(migratedContent, true);
                } else if (isTempTabPath(path)) {
                    await persistTempSession(true);
                }
                clipboardShelf.toast('Migrated inline images to app image library');
            }
        }

        // Update Editor
        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: doc.content }
        });
        lastSavedContent = doc.lastSavedContent;
        tabs.setDirty(path, doc.isDirty);

        // Update Title
        const title = isVirtualTabPath(path) ? (doc.displayName || UNTITLED_TITLE) : path;
        await setWindowTitle(title);
        statusBar.updateSaveTarget(
            isScratchpadPath(path)
                ? 'Workspace (auto)'
                : isTempTabPath(path)
                    ? `${doc.displayName || 'Temp'} (session)`
                    : getBasename(path),
            isVirtualTabPath(path) ? '' : path
        );

        // Add to recent
        if (!isVirtualTabPath(path)) {
            addToRecent(path);
            await startWatching(path);
        }

        await persistTempSession();
        updateTopbar();
    }
}

async function closeTab(path) {
    if (isScratchpadPath(path)) return;

    const doc = openDocuments.get(path);
    if (doc && doc.isDirty) {
        const discard = confirm('This tab has unsaved changes. Close without saving?');
        if (!discard) {
            await switchTab(path);
            const saved = await saveFile();
            if (!saved) return;
        }
    }

    tabs.removeTab(path);
    openDocuments.delete(path);

    if (path === currentFilePath) {
        currentFilePath = null;
        // Switch to last tab or clear editor
        const remaining = tabs.getTabs();
        if (remaining.length > 0) {
            await switchTab(remaining[remaining.length - 1].path);
        } else {
            // Clear editor
            editor.dispatch({
                changes: { from: 0, to: editor.state.doc.length, insert: '' }
            });
            lastSavedContent = '';
            await setWindowTitle('AgentPad');
        }
    }

    await persistTempSession();
    refreshWorkbenchSurfaces();
}

async function loadFile(path) {
    try {
        // If already open, just switch
        if (openDocuments.has(path)) {
            await switchTab(path);
            return;
        }

        const content = await readTextFile(path);

        // Add to state
        openDocuments.set(path, {
            content: content,
            lastSavedContent: content,
            isDirty: false,
            displayName: getBasename(path),
            updatedAt: Date.now()
        });

        // Save previous state before switching
        if (currentFilePath && openDocuments.has(currentFilePath)) {
            const doc = openDocuments.get(currentFilePath);
            const currentContent = editor.state.doc.toString();
            doc.content = currentContent;
            doc.isDirty = currentContent !== doc.lastSavedContent;
            doc.updatedAt = Date.now();
            tabs.setDirty(currentFilePath, doc.isDirty);
        }

        currentFilePath = path;
        tabs.addTab(path);

        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: content }
        });

        // Initialize lastSavedContent
        lastSavedContent = content;
        tabs.setDirty(path, false);

        await setWindowTitle(path);
        statusBar.updateSaveTarget(getBasename(path), path);

        // Add to recent files
        addToRecent(path);

        // Start watcher
        await startWatching(path);
        await persistTempSession();
        refreshWorkbenchSurfaces();

    } catch (err) {
        console.error('Failed to load file:', err);
        alert('Failed to load file: ' + err);
    }
}

// File Operations
async function openFile() {
    try {
        if (!isTauriRuntime) {
            clipboardShelf.toast('Open file is available in the desktop app runtime.', 'warn');
            return;
        }
        const selected = await open({
            filters: [{ name: 'Markdown & YAML', extensions: ['md', 'markdown', 'txt', 'yaml', 'yml'] }]
        });
        if (selected) {
            await loadFile(selected);
        }
    } catch (err) {
        console.error('Failed to open file:', err);
    }
}

async function saveFile(saveAs = false) {
    if (!isTauriRuntime && (!currentFilePath || isVirtualTabPath(currentFilePath) || saveAs)) {
        clipboardShelf.toast('Save As is available in the desktop app runtime.', 'warn');
        return false;
    }
    const content = editor.state.doc.toString();
    const savingVirtual = isVirtualTabPath(currentFilePath);
    const savingScratch = isScratchpadPath(currentFilePath);

    if (!currentFilePath || saveAs || savingVirtual) {
        // Save As
        const selected = await save({
            filters: [{ name: 'Markdown & YAML', extensions: ['md', 'markdown', 'txt', 'yaml', 'yml'] }]
        });
        if (selected) {
            if (savingScratch) {
                try {
                    await persistScratchpad(content, true);
                    await writeTextFile(selected, content);
                    addToRecent(selected);

                    openDocuments.set(selected, {
                        content,
                        lastSavedContent: content,
                        isDirty: false,
                        displayName: getBasename(selected),
                        updatedAt: Date.now()
                    });
                    tabs.addTab(selected);
                    tabs.setDirty(selected, false);
                    await switchTab(selected);
                    await ensureScratchpadTab();
                    await persistTempSession();
                    return true;
                } catch (err) {
                    console.error('Failed to save scratchpad as file:', err);
                    return false;
                }
            }

            const previousPath = currentFilePath;
            currentFilePath = selected;
            await setWindowTitle(currentFilePath);

            if (previousPath && previousPath !== currentFilePath && openDocuments.has(previousPath)) {
                const previousDoc = openDocuments.get(previousPath);
                openDocuments.delete(previousPath);
                previousDoc.displayName = getBasename(currentFilePath);
                previousDoc.updatedAt = Date.now();
                openDocuments.set(currentFilePath, previousDoc);
                tabs.removeTab(previousPath);
                tabs.addTab(currentFilePath);
            } else if (!openDocuments.has(currentFilePath)) {
                openDocuments.set(currentFilePath, {
                    content,
                    lastSavedContent: content,
                    isDirty: false,
                    displayName: getBasename(currentFilePath),
                    updatedAt: Date.now()
                });
                tabs.addTab(currentFilePath);
            }
        } else {
            return false; // Cancelled
        }
    }

    // Save
    try {
        isSaving = true;
        await writeTextFile(currentFilePath, content);
        lastSavedContent = content;
        markCurrentDocumentSaved(content);
        console.log('Saved to', currentFilePath);

        // Update mtime immediately after save to avoid race
        try {
            const stats = await stat(currentFilePath);
            lastKnownMtime = stats.mtime ? new Date(stats.mtime).getTime() : Date.now();
        } catch (e) { }

        addToRecent(currentFilePath);
        // Only start watcher if not watching? 
        // We are already watching if currentFilePath set.
        // await startWatching(currentFilePath); // Redundant if already watching? 
        // It's safer to ensure it.
        await startWatching(currentFilePath);

        // Force render update
        postRenderUpdate(content);
        await persistTempSession();
        return true;
    } catch (err) {
        console.error('Failed to save:', err);
        return false;
    } finally {
        // Release latch after short delay to catch trailing events
        setTimeout(() => {
            isSaving = false;
        }, 500);
    }
}

// Shortcuts
// Image Paste Handling
async function handleImagePaste(view, file) {
    try {
        let destinationDir = '';
        let markdownPath = '';
        const isVirtualTarget = !currentFilePath || isVirtualTabPath(currentFilePath);
        const mime = (file?.type || '').toLowerCase();
        const extByMime = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'image/bmp': 'bmp',
            'image/tiff': 'tiff',
            'image/heic': 'heic'
        };
        const extension = extByMime[mime] || 'png';

        if (!isVirtualTarget) {
            // Saved file path: store in sibling assets folder for portability.
            const pathSep = navigator.userAgent.includes('Win') ? '\\' : '/';
            const fileDir = currentFilePath.substring(0, currentFilePath.lastIndexOf(pathSep));
            destinationDir = `${fileDir}${pathSep}assets`;
        }

        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        if (isVirtualTarget && isTauriRuntime) {
            // Scratch/Temp workflow: save image in app storage and keep markdown lightweight.
            const imagesDir = await getVirtualImagesDirPath();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `clip-${timestamp}.${extension}`;
            const fullPath = await join(imagesDir, filename);

            try {
                await writeFile(fullPath, uint8Array);
                markdownPath = `${APP_IMAGE_MARKDOWN_PREFIX}${filename}`;
                clipboardShelf.toast('Image saved to scratch library');
            } catch (writeErr) {
                // Fallback only if storage write fails.
                console.warn('Virtual image write failed, embedding inline image instead:', writeErr);
                const blob = new Blob([uint8Array], { type: file.type || 'image/png' });
                markdownPath = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
                    reader.readAsDataURL(blob);
                });
                clipboardShelf.toast('Image embedded in note');
            }

            view.dispatch(view.state.replaceSelection(`\n![Image](${markdownPath})\n`));
            if (viewMode === VIEW_MODES.EDITOR) {
                setViewMode(VIEW_MODES.SPLIT, { ratio: 25 });
            }
            return;
        } else if (isVirtualTarget && !isTauriRuntime) {
            const blob = new Blob([uint8Array], { type: file.type || 'image/png' });
            markdownPath = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
                reader.readAsDataURL(blob);
            });
            view.dispatch(view.state.replaceSelection(`\n![Image](${markdownPath})\n`));
            if (viewMode === VIEW_MODES.EDITOR) {
                setViewMode(VIEW_MODES.SPLIT, { ratio: 25 });
            }
            return;
        }

        try {
            await mkdir(destinationDir, { recursive: true });
        } catch (e) {
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `image-${timestamp}.${extension}`;
        const fullPath = `${destinationDir}${navigator.userAgent.includes('Win') ? '\\' : '/'}${filename}`;

        try {
            await writeFile(fullPath, uint8Array);
            markdownPath = `assets/${filename}`;
        } catch (writeErr) {
            // Fallback when file write fails: still keep image in current note.
            console.warn('Image file write failed, embedding inline image instead:', writeErr);
            const blob = new Blob([uint8Array], { type: file.type || 'image/png' });
            markdownPath = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
                reader.readAsDataURL(blob);
            });
            clipboardShelf.toast('Image embedded in note');
        }

        view.dispatch(view.state.replaceSelection(`\n![Image](${markdownPath})\n`));

    } catch (err) {
        console.error('Image paste failed:', err);
        alert('Failed to paste image: ' + err);
    }
}

window.addEventListener('paste', (event) => {
    const active = document.activeElement;
    const isEditorFocused = active && (
        active.classList?.contains('cm-content') ||
        !!active.closest?.('.cm-editor')
    );
    if (isEditorFocused) return;

    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.includes('image')) {
            const file = items[i].getAsFile();
            if (!file) return;
            event.preventDefault();
            handleImagePaste(editor, file);
            return;
        }
    }
});

window.addEventListener('beforeunload', (event) => {
    persistTempSession(true);
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
});

window.addEventListener('keydown', (e) => {
    const cmd = e.metaKey || e.ctrlKey;

    if (cmd) {
        if (e.shiftKey && e.code === 'Space') {
            e.preventDefault();
            ensureScratchpadTab().then(() => switchTab(SCRATCH_TAB_PATH));
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'p':
                e.preventDefault();
                if (viewMode === VIEW_MODES.SPLIT) {
                    setViewMode(VIEW_MODES.EDITOR);
                } else {
                    setViewMode(VIEW_MODES.SPLIT, { ratio: 25 });
                }
                break;
            case 'o':
                e.preventDefault();
                openFile();
                break;
            case 't':
                if (!e.shiftKey) {
                    e.preventDefault();
                    createTempTab();
                }
                break;
            case 's':
                e.preventDefault();
                saveFile();
                break;
            case 'w':
                e.preventDefault();
                if (currentFilePath && !isScratchpadPath(currentFilePath)) {
                    closeTab(currentFilePath);
                }
                break;
            case 'r':
                e.preventDefault();
                forceRefresh();
                break;
            case 'k':
                if (e.shiftKey) {
                    e.preventDefault();
                    clipboardShelf.toggle();
                }
                break;
            case 'v':
                if (e.shiftKey) {
                    e.preventDefault();
                    clipboardShelf.addFromClipboard();
                }
                break;
            case 'y':
                if (e.shiftKey) {
                    e.preventDefault();
                    addSelectionToShelf();
                }
                break;
            case 'j':
                if (e.shiftKey) {
                    e.preventDefault();
                    clipboardShelf.focusSearch();
                }
                break;
            case 'g':
                if (e.shiftKey) {
                    e.preventDefault();
                    const sel = editor.state.selection.main;
                    const selectedText = sel.from === sel.to ? '' : editor.state.doc.sliceString(sel.from, sel.to);
                    const text = selectedText || editor.state.doc.toString();
                    if (!text.trim()) {
                        clipboardShelf.toast('Nothing to save as prompt', 'warn');
                        break;
                    }
                    const title = prompt('Prompt title (optional):') || '';
                    promptLibrary.addPrompt(text, title).then(() => {
                        clipboardShelf.toast('Saved to Prompts');
                    });
                }
                break;
        }
    }
});

// Redundant listeners removed
