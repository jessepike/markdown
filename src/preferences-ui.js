import { prefs } from './preferences.js';

export class PreferencesUI {
    constructor() {
        this.overlay = null;
        this.isOpen = false;
    }

    init() {
        // No-op for now, lazy create on open
    }

    createModal() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.close();
        };

        const modal = document.createElement('div');
        modal.className = 'modal-content prefs-modal';

        const header = document.createElement('h3');
        header.textContent = 'Preferences';
        modal.appendChild(header);

        // Sections
        const createSection = (title) => {
            const el = document.createElement('div');
            el.className = 'prefs-section';
            const h4 = document.createElement('h4');
            h4.textContent = title;
            el.appendChild(h4);
            return el;
        };

        const createRow = (label, input) => {
            const row = document.createElement('div');
            row.className = 'prefs-row';
            const lbl = document.createElement('label');
            lbl.className = 'prefs-label';
            lbl.textContent = label;
            row.appendChild(lbl);
            row.appendChild(input);
            return row;
        };

        // Editor Section
        const editorSec = createSection('Editor');

        // Font Size
        const fontSizeInput = document.createElement('input');
        fontSizeInput.type = 'number';
        fontSizeInput.className = 'prefs-input';
        fontSizeInput.value = prefs.get('editorFontSize');
        fontSizeInput.onchange = (e) => prefs.set('editorFontSize', parseInt(e.target.value));
        editorSec.appendChild(createRow('Font Size (px)', fontSizeInput));

        // Sync Scroll
        const syncCheck = document.createElement('input');
        syncCheck.type = 'checkbox';
        syncCheck.className = 'prefs-toggle';
        syncCheck.checked = prefs.get('syncScroll');
        syncCheck.onchange = (e) => prefs.set('syncScroll', e.target.checked); // Logic handling in main.js
        editorSec.appendChild(createRow('Synchronized Scrolling', syncCheck));

        // Render Frontmatter
        const fmCheck = document.createElement('input');
        fmCheck.type = 'checkbox';
        fmCheck.className = 'prefs-toggle';
        fmCheck.checked = prefs.get('renderFrontmatter');
        fmCheck.onchange = (e) => prefs.set('renderFrontmatter', e.target.checked);
        editorSec.appendChild(createRow('Render Frontmatter', fmCheck));

        modal.appendChild(editorSec);

        // Export/LLM Section
        const llmSec = createSection('Export & Sanitization');

        // XML Tag
        const tagInput = document.createElement('input');
        tagInput.type = 'text';
        tagInput.className = 'prefs-input';
        tagInput.value = prefs.get('xmlWrapperTag');
        tagInput.onchange = (e) => prefs.set('xmlWrapperTag', e.target.value);
        llmSec.appendChild(createRow('XML Wrapper Tag', tagInput));

        // Include Frontmatter in Copy for LLM
        const fmLlmCheck = document.createElement('input');
        fmLlmCheck.type = 'checkbox';
        fmLlmCheck.className = 'prefs-toggle';
        fmLlmCheck.checked = prefs.get('includeFrontmatterInCopyLLM');
        fmLlmCheck.onchange = (e) => prefs.set('includeFrontmatterInCopyLLM', e.target.checked);
        llmSec.appendChild(createRow('Include Frontmatter (LLM Copy)', fmLlmCheck));

        // Strip Frontmatter (General Export)
        const stripFmCheck = document.createElement('input');
        stripFmCheck.type = 'checkbox';
        stripFmCheck.className = 'prefs-toggle';
        stripFmCheck.checked = prefs.get('sanitizationStripFrontmatter');
        stripFmCheck.onchange = (e) => prefs.set('sanitizationStripFrontmatter', e.target.checked);
        llmSec.appendChild(createRow('Strip Frontmatter (HTML/Rich Text)', stripFmCheck));

        // Include Theme
        const themeCheck = document.createElement('input');
        themeCheck.type = 'checkbox';
        themeCheck.className = 'prefs-toggle';
        themeCheck.checked = prefs.get('exportIncludeTheme');
        themeCheck.onchange = (e) => prefs.set('exportIncludeTheme', e.target.checked);
        llmSec.appendChild(createRow('Include Theme Styles', themeCheck));

        modal.appendChild(llmSec);

        // System Section
        const sysSec = createSection('System');

        // Always Reload
        const reloadCheck = document.createElement('input');
        reloadCheck.type = 'checkbox';
        reloadCheck.className = 'prefs-toggle';
        reloadCheck.checked = prefs.get('alwaysReload');
        reloadCheck.onchange = (e) => prefs.set('alwaysReload', e.target.checked);
        sysSec.appendChild(createRow('Always Reload on External Change', reloadCheck));

        const promptExternalCheck = document.createElement('input');
        promptExternalCheck.type = 'checkbox';
        promptExternalCheck.className = 'prefs-toggle';
        promptExternalCheck.checked = prefs.get('promptOnExternalChange');
        promptExternalCheck.onchange = (e) => prefs.set('promptOnExternalChange', e.target.checked);
        sysSec.appendChild(createRow('Prompt on External Change', promptExternalCheck));

        modal.appendChild(sysSec);


        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn secondary';
        closeBtn.onclick = () => this.close();
        modal.appendChild(closeBtn);

        overlay.appendChild(modal);
        return overlay;
    }

    open() {
        if (this.isOpen) return;
        this.overlay = this.createModal();
        document.body.appendChild(this.overlay);
        this.isOpen = true;
    }

    close() {
        if (!this.isOpen) return;
        this.overlay.remove();
        this.overlay = null;
        this.isOpen = false;
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }
}

export const prefsUI = new PreferencesUI();
