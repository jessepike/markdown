import './style.css';
import { createEditor } from './editor.js';
import DOMPurify from 'dompurify';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';

const RECENT_FILES_KEY = 'pike-recent-files';
const MAX_RECENT_FILES = 10;

// Listen for Menu Events
listen('menu-open', () => openFile());
listen('menu-save', () => saveFile());
listen('menu-save-as', () => saveFile(true));
listen('menu-open-recent', () => showRecentFilesModal());
listen('menu-close-recent', () => clearRecentFiles());

// DOM Elements
const app = document.getElementById('app');
const editorContainer = document.createElement('div');
editorContainer.className = 'editor-pane';
const previewContainer = document.createElement('div');
previewContainer.className = 'preview-pane single-mode';
const markdownBody = document.createElement('div');
markdownBody.className = 'markdown-body';
previewContainer.appendChild(markdownBody);

app.appendChild(editorContainer);
app.appendChild(previewContainer);

const controls = document.createElement('div');
controls.className = 'controls';

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

controls.appendChild(openBtn);
controls.appendChild(previewBtn);
editorContainer.appendChild(controls);

// State
let isPreviewVisible = false;
let currentFilePath = null;
let debounceTimer = null;
const DEBOUNCE_MS = 500; // Spec says 500ms for auto-save

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
const editor = createEditor(editorContainer, "# Welcome to Markdown Workbench\n\nStart typing or Open (Cmd+O) a file...", (newContent) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        // 1. Update Preview
        worker.postMessage(newContent);
        // 2. Auto-save
        performAutoSave(newContent);
    }, DEBOUNCE_MS);
});

// Initial Render
worker.postMessage(editor.state.doc.toString());

// Toggle Logic
// Toggle Logic
function togglePreview() {
    isPreviewVisible = !isPreviewVisible;
    if (isPreviewVisible) {
        previewContainer.classList.add('visible');
        previewBtn.classList.add('active');
    } else {
        previewContainer.classList.remove('visible');
        previewBtn.classList.remove('active');
        editor.focus();
    }
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

        // Update Editor
        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: content }
        });
        // Update Preview immediately
        worker.postMessage(content);

        document.title = `${currentFilePath} — Pike Markdown`;
        addToRecent(path);
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
            document.title = `${currentFilePath} — Pike Markdown`;
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
        }
    }
});
