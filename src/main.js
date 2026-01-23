import './style.css';
import { createEditor } from './editor.js';
import DOMPurify from 'dompurify';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

const RECENT_FILES_KEY = 'pike-recent-files';
const SPLIT_RATIO_KEY = 'pike-split-ratio';
const VIEW_MODE_KEY = 'pike-view-mode';
const SYNC_SCROLL_KEY = 'pike-sync-scroll';
const RENDER_FM_KEY = 'pike-render-fm';
const MAX_RECENT_FILES = 10;

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
let debounceTimer = null;
let isPreviewPaused = false;

console.log('Pike Markdown: Main script initializing...');

// GLOBAL ERROR HANDLER
window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global Error Caught:', message, error);
    alert(`App Error: ${message}`);
};

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
const previewContainer = document.createElement('div');
previewContainer.className = 'preview-pane single-mode';
const markdownBody = document.createElement('div');
markdownBody.className = 'markdown-body';
previewContainer.appendChild(markdownBody);

const resizer = document.createElement('div');
resizer.className = 'resizer';

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
const controls = document.createElement('div');
controls.className = 'controls';
// ... rest of DOM setup matches previous flow, but now listeners are safe.

// Open Button
const openBtn = document.createElement('button');
openBtn.textContent = 'Open';
openBtn.className = 'btn';
openBtn.onclick = openFile;
openBtn.title = 'Open File (Cmd+O)';

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

controls.appendChild(openBtn);
controls.appendChild(codeBtn);
controls.appendChild(previewBtn);
app.appendChild(controls);

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

// Auto-save Logic
async function performAutoSave(content) {
    if (currentFilePath) {
        try {
            await writeTextFile(currentFilePath, content);
            console.log('Auto-saved to', currentFilePath);
        } catch (err) {
            console.error('Auto-save failed:', err);
        }
    }
}

// Editor Setup
const editor = createEditor(editorContainer, "", (newContent) => {
    const contentLength = newContent.length;

    // Adaptive Logic
    if (contentLength > THRESHOLD_HUGE) {
        // Paused Mode
        if (!isPreviewPaused) {
            isPreviewPaused = true;
            pausedIndicator.classList.add('visible');
        }
    } else {
        // Active Mode
        if (isPreviewPaused) {
            isPreviewPaused = false;
            pausedIndicator.classList.remove('visible');
        }

        const delay = contentLength > THRESHOLD_LARGE ? DEBOUNCE_SLOW : DEBOUNCE_NORMAL;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // 1. Update Preview (if visible)
            if (viewMode !== VIEW_MODES.EDITOR) {
                worker.postMessage({
                    content: newContent,
                    options: { renderFrontmatter: isRenderFmEnabled }
                });
            }
            // 2. Auto-save
            performAutoSave(newContent);
        }, delay);
    }
});

// Initial Render
worker.postMessage({
    content: editor.state.doc.toString(),
    options: { renderFrontmatter: isRenderFmEnabled }
});


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
        await listen('file-opened-from-launch', (e) => loadFile(e.payload));

        await listen('menu-new', async () => {
            currentFilePath = null;
            editor.dispatch({
                changes: { from: 0, to: editor.state.doc.length, insert: "" }
            });
            worker.postMessage({
                content: "",
                options: { renderFrontmatter: isRenderFmEnabled }
            });
            await setWindowTitle('Untitled');
        });

        await listen('toggle-sync-scroll', (e) => {
            isSyncScrollEnabled = e.payload;
            localStorage.setItem(SYNC_SCROLL_KEY, isSyncScrollEnabled);
        });

        await listen('toggle-frontmatter', (e) => {
            isRenderFmEnabled = e.payload;
            localStorage.setItem(RENDER_FM_KEY, isRenderFmEnabled);
            forceRefresh();
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
                    await loadFile(path);
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
            await loadFile(launchPath);
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
            worker.postMessage({
                content: editor.state.doc.toString(),
                options: { renderFrontmatter: isRenderFmEnabled }
            });
            editor.focus();
            break;
        case VIEW_MODES.PREVIEW:
            editorContainer.style.display = 'none'; // Hide editor in full preview
            editorContainer.style.width = ''; // Reset width styles
            previewContainer.style.width = '';
            previewContainer.classList.add('visible', 'single-mode');
            previewBtn.classList.add('active');
            // Force render on enter preview
            worker.postMessage({
                content: editor.state.doc.toString(),
                options: { renderFrontmatter: isRenderFmEnabled }
            });
            break;
    }
}

function forceRefresh() {
    const content = editor.state.doc.toString();
    worker.postMessage({
        content: content,
        options: { renderFrontmatter: isRenderFmEnabled }
    });
    // Also trigger save if huge
    performAutoSave(content);
}

// Recent Files Logic
function getRecentFiles() {
    try {
        const stored = localStorage.getItem(RECENT_FILES_KEY);
        return stored ? JSON.parse(stored) : [];
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
            await loadFile(path);
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

async function loadFile(path) {
    try {
        const content = await readTextFile(path);
        currentFilePath = path;

        // Update Title first (fail-safe)
        await setWindowTitle(path);
        addToRecent(path);

        // Update Editor
        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: content }
        });
        // Update Preview immediately
        worker.postMessage(content);
    } catch (err) {
        console.error('Failed to load file:', err);
        alert(`Failed to open file: ${path}`);
    }
}

// File Operations
async function openFile() {
    try {
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
    if (!currentFilePath || saveAs) {
        // Save As
        const selected = await save({
            filters: [{ name: 'Markdown', extensions: ['md'] }]
        });
        if (selected) {
            currentFilePath = selected;
            await setWindowTitle(currentFilePath);
        } else {
            return; // Cancelled
        }
    }

    // Save
    try {
        await writeTextFile(currentFilePath, content);
        console.log('Saved to', currentFilePath);
        addToRecent(currentFilePath);
        // Force render update
        worker.postMessage(content);
    } catch (err) {
        console.error('Failed to save:', err);
    }
}

// Shortcuts
window.addEventListener('keydown', (e) => {
    const cmd = e.metaKey || e.ctrlKey;

    if (cmd) {
        switch (e.key.toLowerCase()) {
            case 'p':
                e.preventDefault();
                togglePreview();
                break;
            case 'o':
                e.preventDefault();
                openFile();
                break;
            case 's':
                e.preventDefault();
                saveFile();
                break;
            case 'r':
                e.preventDefault();
                forceRefresh();
                break;
        }
    }
});

// Redundant listeners removed

