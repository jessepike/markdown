import './style.css';
import { createEditor, toggleSearch, setEditorTheme } from './editor.js';
import DOMPurify from 'dompurify';
import { readTextFile, writeTextFile, stat, mkdir, writeFile, exists } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
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

// Helper function to set window title using Tauri API
async function setWindowTitle(title) {
    try {
        const window = getCurrentWindow();
        await window.setTitle(title);
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
let tempTabCounter = 1;

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
    if (scratchStoragePath) return scratchStoragePath;
    const configDir = await appConfigDir();
    if (!(await exists(configDir))) {
        await mkdir(configDir, { recursive: true });
    }
    scratchStoragePath = await join(configDir, SCRATCH_FILE);
    return scratchStoragePath;
}

async function loadScratchpadContent() {
    try {
        const scratchPath = await getScratchStoragePath();
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
            await writeTextFile(scratchPath, content);
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
            displayName: 'Scratchpad'
        });
    }

    tabs.addTab(SCRATCH_TAB_PATH, { name: 'Scratchpad', closable: false, activate: false });
    tabs.setDirty(SCRATCH_TAB_PATH, false);
}

function postRenderUpdate(content) {
    worker.postMessage({
        content,
        options: { renderFrontmatter: isRenderFmEnabled }
    });
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
    tabs.setDirty(currentFilePath, doc.isDirty);
}

function markCurrentDocumentSaved(content) {
    if (!currentFilePath) return;
    const doc = openDocuments.get(currentFilePath);
    if (!doc) return;

    doc.content = content;
    doc.lastSavedContent = content;
    doc.isDirty = false;
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
    if (!(await ensureCanDiscardUnsavedChanges(actionLabel))) return false;
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

async function createTempTab() {
    const path = `${TEMP_TAB_PREFIX}${Date.now()}`;
    const name = getNextTempTabName();

    openDocuments.set(path, {
        content: '',
        lastSavedContent: '',
        isDirty: false,
        displayName: name
    });

    tabs.addTab(path, { name });
    await switchTab(path);
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
const app = document.getElementById('app');

const editorContainer = document.createElement('div');
editorContainer.className = 'editor-pane';

// Init Tabs
tabs.init(editorContainer, (path) => switchTab(path), (path) => closeTab(path));

const previewContainer = document.createElement('div');
previewContainer.className = 'preview-pane single-mode';
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
        <div class="drop-zone-text">Drop Markdown file to open</div>
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
const controls = document.createElement('div');
controls.className = 'controls';
controls.setAttribute('data-tauri-drag-region', 'false');
// ... rest of DOM setup matches previous flow, but now listeners are safe.

// Open Button
const openBtn = document.createElement('button');
openBtn.textContent = 'Open';
openBtn.className = 'btn';
openBtn.onclick = openFile;
openBtn.title = 'Open File (Cmd+O)';

const newTabBtn = document.createElement('button');
newTabBtn.textContent = '+ Tab';
newTabBtn.className = 'btn';
newTabBtn.onclick = createTempTab;
newTabBtn.title = 'New temporary tab (Cmd+T)';

// Preview Toggle Button
const previewBtn = document.createElement('button');
previewBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
previewBtn.className = 'btn icon-btn';
previewBtn.onclick = togglePreview;
previewBtn.title = 'Toggle Preview (Cmd+P)';

// Code View Button (Raw)
const codeBtn = document.createElement('button');
codeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
codeBtn.className = 'btn icon-btn';
codeBtn.onclick = () => setViewMode(VIEW_MODES.EDITOR);
codeBtn.title = 'Raw View (Cmd+E)';

const shelfBtn = document.createElement('button');
shelfBtn.textContent = 'Shelf';
shelfBtn.className = 'btn';
shelfBtn.title = 'Toggle Clipboard Shelf (Cmd+Shift+K). Add clipboard: Cmd+Shift+V, selection: Cmd+Shift+Y, search: Cmd+Shift+J';
shelfBtn.onclick = () => clipboardShelf.toggle();

controls.appendChild(openBtn);
controls.appendChild(newTabBtn);
controls.appendChild(codeBtn);
controls.appendChild(previewBtn);
controls.appendChild(shelfBtn);
editorContainer.appendChild(controls);

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
    await ensureScratchpadTab();
    await switchTab(SCRATCH_TAB_PATH);
    await clipboardShelf.init(document.body);
    postRenderUpdate(editor.state.doc.toString());
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
const sidebar = new Sidebar(sidebarContainer, async (path) => {
    await openPathWithUnsavedCheck(path, 'open a file from the sidebar');
});

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

        await listen('menu-export-pdf', () => {
            // Print dialog handles PDF generation
            window.print();
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
                if (path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.txt')) {
                    await openPathWithUnsavedCheck(path, 'open the dropped file');
                } else {
                    alert("File type not supported. Please drop a .md, .markdown, or .txt file.");
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
        } else {
            // Set default title if no file loaded
            await setWindowTitle('Untitled');
        }
    } catch (err) {
        console.error('Failed to register event listeners:', err);
        alert(`Failed to initialize app: ${err.message}`);
    }
})();

// Toggle Logic
function togglePreview() {
    // Cycle: EDITOR -> SPLIT -> PREVIEW -> EDITOR
    if (viewMode === VIEW_MODES.EDITOR) {
        setViewMode(VIEW_MODES.SPLIT);
    } else if (viewMode === VIEW_MODES.SPLIT) {
        setViewMode(VIEW_MODES.PREVIEW);
    } else {
        setViewMode(VIEW_MODES.EDITOR);
    }
}

function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem(VIEW_MODE_KEY, mode);

    // Reset Classes
    app.classList.remove('split-mode');
    previewContainer.classList.remove('visible', 'single-mode');
    previewBtn.classList.remove('active');

    switch (mode) {
        case VIEW_MODES.EDITOR:
            editorContainer.style.display = 'block';
            editor.focus();
            break;
        case VIEW_MODES.SPLIT:
            app.classList.add('split-mode');
            editorContainer.style.display = 'block';

            // Restore saved ratio or default to 50%
            const savedRatio = localStorage.getItem(SPLIT_RATIO_KEY);
            const ratio = savedRatio ? parseFloat(savedRatio) : 50;

            editorContainer.style.width = `${ratio}%`;
            previewContainer.style.width = `${100 - ratio}%`;

            previewContainer.classList.add('visible');
            previewBtn.classList.add('active');
            // Force render on enter split
            postRenderUpdate(editor.state.doc.toString());
            editor.focus();
            break;
        case VIEW_MODES.PREVIEW:
            editorContainer.style.display = 'none'; // Hide editor in full preview
            editorContainer.style.width = ''; // Reset width styles
            previewContainer.style.width = '';
            previewContainer.classList.add('visible', 'single-mode');
            previewBtn.classList.add('active');
            // Force render on enter preview
            postRenderUpdate(editor.state.doc.toString());
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
}

// Init View Mode from Storage
const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
if (savedViewMode) {
    setViewMode(savedViewMode);
}

function clearRecentFiles() {
    localStorage.removeItem(RECENT_FILES_KEY);
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
        tabs.setDirty(currentFilePath, doc.isDirty);
        // doc.scrollTop = ... (CodeMirror scroll state is complex, omit for MVP)
    }

    // Load new state
    if (openDocuments.has(path)) {
        currentFilePath = path;
        tabs.setActive(path);
        const doc = openDocuments.get(path);

        // Update Editor
        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: doc.content }
        });
        lastSavedContent = doc.lastSavedContent;
        tabs.setDirty(path, doc.isDirty);

        // Update Title
        const title = isVirtualTabPath(path) ? (doc.displayName || UNTITLED_TITLE) : path;
        await setWindowTitle(title);

        // Add to recent
        if (!isVirtualTabPath(path)) {
            addToRecent(path);
        }
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
            displayName: getBasename(path)
        });

        // Save previous state before switching
        if (currentFilePath && openDocuments.has(currentFilePath)) {
            const doc = openDocuments.get(currentFilePath);
            const currentContent = editor.state.doc.toString();
            doc.content = currentContent;
            doc.isDirty = currentContent !== doc.lastSavedContent;
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

        // Add to recent files
        addToRecent(path);

        // Start watcher
        await startWatching(path);

    } catch (err) {
        console.error('Failed to load file:', err);
        alert('Failed to load file: ' + err);
    }
}

// File Operations
async function openFile() {
    try {
        if (!(await ensureCanDiscardUnsavedChanges('open another file'))) return;

        const selected = await open({
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
        });
        if (selected) {
            await loadFile(selected);
        }
    } catch (err) {
        console.error('Failed to open file:', err);
    }
}

async function saveFile(saveAs = false) {
    const content = editor.state.doc.toString();
    const savingVirtual = isVirtualTabPath(currentFilePath);
    const savingScratch = isScratchpadPath(currentFilePath);

    if (!currentFilePath || saveAs || savingVirtual) {
        // Save As
        const selected = await save({
            filters: [{ name: 'Markdown', extensions: ['md'] }]
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
                        displayName: getBasename(selected)
                    });
                    tabs.addTab(selected);
                    tabs.setDirty(selected, false);
                    await switchTab(selected);
                    await ensureScratchpadTab();
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
                openDocuments.set(currentFilePath, previousDoc);
                tabs.removeTab(previousPath);
                tabs.addTab(currentFilePath);
            } else if (!openDocuments.has(currentFilePath)) {
                openDocuments.set(currentFilePath, {
                    content,
                    lastSavedContent: content,
                    isDirty: false,
                    displayName: getBasename(currentFilePath)
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
        if (!currentFilePath) {
            alert('Please save the current file before pasting images.');
            return;
        }

        // Determine destination
        // We'll put it in an 'assets' folder relative to the current file
        // 1. Get current file dir
        // Simple string manipulation for now (Node/Rust path is better, but this works for MVP)
        const pathSep = navigator.userAgent.includes('Win') ? '\\' : '/';
        const fileDir = currentFilePath.substring(0, currentFilePath.lastIndexOf(pathSep));
        const assetsDir = `${fileDir}${pathSep}assets`;

        // 2. Ensure assets dir exists
        try {
            await mkdir(assetsDir, { recursive: true });
        } catch (e) {
            // Ignore if exists, how to check? 
            // writeBinaryFile might fail if dir missing?
            // Actually, we should check existence. 
            // Let's just try to create. 
        }

        // 3. Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `image-${timestamp}.png`;
        const fullPath = `${assetsDir}${pathSep}${filename}`;

        // 4. Read data
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        // 5. Write file
        await writeFile(fullPath, uint8Array);

        // 6. Insert Markdown
        // Relative path validation: 'assets/filename.png'
        const relativePath = `assets/${filename}`;

        view.dispatch(view.state.replaceSelection(`![Image](${relativePath})`));

    } catch (err) {
        console.error('Image paste failed:', err);
        alert('Failed to paste image: ' + err);
    }
}

window.addEventListener('beforeunload', (event) => {
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
                togglePreview();
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
        }
    }
});

// Redundant listeners removed
