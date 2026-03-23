import { appConfigDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const SHELF_FILE = 'clipboard-shelf.json';
const MAX_ITEMS = 100;

function createTitle(text) {
    const firstLine = text.split(/\r?\n/).find(Boolean) || 'Untitled';
    return firstLine.length > 42 ? `${firstLine.slice(0, 42)}...` : firstLine;
}

function nowIso() {
    return new Date().toISOString();
}

function isExpired(item) {
    if (!item.expiresAt) return false;
    return new Date(item.expiresAt).getTime() <= Date.now();
}

export class ClipboardShelf {
    constructor() {
        this.items = [];
        this.container = null;
        this.panel = null;
        this.path = null;
        this.getSelectionText = null;
        this.searchQuery = '';
        this.defaultSensitive = false;
        this.defaultTtlMinutes = 0;
        this.hideSensitive = true;
        this.revealed = new Set();
        this.toastHost = null;
        this.listeners = new Set();
    }

    onChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emitChange() {
        const snapshot = this.getItems();
        this.listeners.forEach(listener => {
            try {
                listener(snapshot);
            } catch (err) {
                console.error('ClipboardShelf listener error:', err);
            }
        });
    }

    getItems() {
        return [...this.items].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    setSelectionProvider(provider) {
        this.getSelectionText = provider;
    }

    async init(container) {
        this.container = container;
        const configDir = await appConfigDir();
        if (!(await exists(configDir))) {
            await mkdir(configDir, { recursive: true });
        }
        this.path = await join(configDir, SHELF_FILE);
        await this.load();
        this.ensureToastHost();
    }

    ensureToastHost() {
        if (!this.container || this.toastHost) return;
        const host = document.createElement('div');
        host.className = 'app-toast-host';
        this.container.appendChild(host);
        this.toastHost = host;
    }

    toast(message, kind = 'info') {
        this.ensureToastHost();
        if (!this.toastHost) return;

        const toast = document.createElement('div');
        toast.className = `app-toast ${kind}`;
        toast.textContent = message;
        this.toastHost.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 160);
        }, 1700);
    }

    isOpen() {
        return !!(this.panel && this.panel.parentElement);
    }

    focusSearch() {
        if (!this.isOpen()) {
            this.toggle();
        }
        const input = this.panel?.querySelector('#clipboard-shelf-search');
        if (input) input.focus();
    }

    async load() {
        try {
            if (!(await exists(this.path))) return;
            const raw = await readTextFile(this.path);
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.items = parsed
                    .map(item => ({
                        id: item.id || Date.now().toString(36),
                        title: item.title || createTitle(item.text || ''),
                        text: item.text || '',
                        source: item.source || 'manual',
                        createdAt: item.createdAt || nowIso(),
                        pinned: !!item.pinned,
                        sensitive: !!item.sensitive,
                        expiresAt: item.expiresAt || null
                    }))
                    .filter(item => item.text.trim().length > 0);

                await this.purgeExpired('Expired sensitive notes removed');
            }
            this.emitChange();
        } catch (err) {
            console.error('Failed to load clipboard shelf:', err);
        }
    }

    async save() {
        try {
            if (!this.path) return;
            await writeTextFile(this.path, JSON.stringify(this.items, null, 2));
            this.emitChange();
        } catch (err) {
            console.error('Failed to save clipboard shelf:', err);
        }
    }

    async purgeExpired(toastMessage = null) {
        const before = this.items.length;
        this.items = this.items.filter(item => !isExpired(item));
        if (this.items.length !== before) {
            await this.save();
            this.renderItems();
            if (toastMessage) this.toast(toastMessage);
        }
    }

    parseTtlToExpiresAt(ttlMinutes) {
        const minutes = Number(ttlMinutes || 0);
        if (!minutes || minutes <= 0) return null;
        const expires = new Date(Date.now() + minutes * 60 * 1000);
        return expires.toISOString();
    }

    async addText(text, source = 'manual', options = {}) {
        if (!text || !text.trim()) return;

        await this.purgeExpired();

        const item = {
            id: Date.now().toString(36),
            title: createTitle(text),
            text,
            source,
            createdAt: nowIso(),
            pinned: false,
            sensitive: !!options.sensitive,
            expiresAt: options.expiresAt || this.parseTtlToExpiresAt(options.ttlMinutes)
        };

        this.items = [item, ...this.items].slice(0, MAX_ITEMS);
        await this.save();
        this.renderItems();
        this.toast('Saved to Shelf');
    }

    async addFromClipboard(options = {}) {
        try {
            const text = await navigator.clipboard.readText();
            if (!text || !text.trim()) {
                this.toast('Clipboard is empty', 'warn');
                return;
            }
            await this.addText(text, 'clipboard', options);
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            this.toast('Failed to read clipboard', 'error');
        }
    }

    async removeItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.revealed.delete(id);
        await this.save();
        this.renderItems();
        this.toast('Removed from Shelf');
    }

    async togglePin(id) {
        const item = this.items.find(entry => entry.id === id);
        if (!item) return;
        item.pinned = !item.pinned;
        await this.save();
        this.renderItems();
        this.toast(item.pinned ? 'Pinned' : 'Unpinned');
    }

    toggleReveal(id) {
        if (this.revealed.has(id)) {
            this.revealed.delete(id);
        } else {
            this.revealed.add(id);
        }
        this.renderItems();
    }

    async copyItem(item) {
        try {
            if (isExpired(item)) {
                await this.purgeExpired('Item expired and was removed');
                return;
            }
            await navigator.clipboard.writeText(item.text);
            this.toast('Copied to clipboard');
        } catch (err) {
            console.error('Failed to copy shelf item:', err);
            this.toast('Failed to copy', 'error');
        }
    }

    setSearchQuery(query) {
        this.searchQuery = (query || '').trim().toLowerCase();
        this.renderItems();
    }

    toggle() {
        if (this.isOpen()) {
            this.panel.remove();
            this.panel = null;
            return;
        }
        this.renderPanel();
    }

    getVisibleItems() {
        const filtered = this.items.filter(item => {
            if (isExpired(item)) return false;
            if (!this.searchQuery) return true;
            const hay = `${item.title}\n${item.text}\n${item.source}`.toLowerCase();
            return hay.includes(this.searchQuery);
        });

        return filtered.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    renderPanel() {
        const panel = document.createElement('div');
        panel.className = 'clipboard-shelf-panel';
        panel.setAttribute('data-tauri-drag-region', 'false');

        const header = document.createElement('div');
        header.className = 'clipboard-shelf-header';

        const title = document.createElement('h3');
        title.textContent = 'Clipboard Shelf';
        header.appendChild(title);

        const headerActions = document.createElement('div');
        headerActions.className = 'clipboard-shelf-header-actions';

        const hideSensitiveBtn = document.createElement('button');
        hideSensitiveBtn.className = 'btn secondary';
        hideSensitiveBtn.textContent = this.hideSensitive ? 'Show Sensitive' : 'Hide Sensitive';
        hideSensitiveBtn.onclick = () => {
            this.hideSensitive = !this.hideSensitive;
            hideSensitiveBtn.textContent = this.hideSensitive ? 'Show Sensitive' : 'Hide Sensitive';
            this.renderItems();
        };
        headerActions.appendChild(hideSensitiveBtn);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn secondary';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
            panel.remove();
            this.panel = null;
        };
        headerActions.appendChild(closeBtn);

        header.appendChild(headerActions);

        const actions = document.createElement('div');
        actions.className = 'clipboard-shelf-actions';

        const addClipboardBtn = document.createElement('button');
        addClipboardBtn.className = 'btn';
        addClipboardBtn.textContent = 'Add Clipboard';
        addClipboardBtn.onclick = () => this.addFromClipboard({ sensitive: this.defaultSensitive, ttlMinutes: this.defaultTtlMinutes });
        actions.appendChild(addClipboardBtn);

        const addSelectionBtn = document.createElement('button');
        addSelectionBtn.className = 'btn';
        addSelectionBtn.textContent = 'Add Selection';
        addSelectionBtn.onclick = async () => {
            if (!this.getSelectionText) {
                this.toast('No editor selection available', 'warn');
                return;
            }
            const text = this.getSelectionText();
            if (!text || !text.trim()) {
                this.toast('Select text in the editor first', 'warn');
                return;
            }
            await this.addText(text, 'selection', { sensitive: this.defaultSensitive, ttlMinutes: this.defaultTtlMinutes });
        };
        actions.appendChild(addSelectionBtn);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn secondary';
        clearBtn.textContent = 'Clear';
        clearBtn.onclick = async () => {
            const ok = confirm('Clear all clipboard shelf items?');
            if (!ok) return;
            this.items = [];
            this.revealed.clear();
            await this.save();
            this.renderItems();
            this.toast('Shelf cleared');
        };
        actions.appendChild(clearBtn);

        const composer = document.createElement('div');
        composer.className = 'clipboard-shelf-composer';

        const helper = document.createElement('div');
        helper.className = 'clipboard-shelf-helper';
        helper.textContent = 'Shortcuts: Cmd/Ctrl+Shift+K toggle, +Shift+V add clipboard, +Shift+Y add selection, +Shift+J focus search';
        composer.appendChild(helper);

        const search = document.createElement('input');
        search.className = 'clipboard-shelf-search';
        search.id = 'clipboard-shelf-search';
        search.placeholder = 'Search snippets...';
        search.value = this.searchQuery;
        search.addEventListener('input', event => this.setSearchQuery(event.target.value));
        composer.appendChild(search);

        const optionsRow = document.createElement('div');
        optionsRow.className = 'clipboard-shelf-options';

        const sensitiveWrap = document.createElement('label');
        sensitiveWrap.className = 'clipboard-shelf-option';
        const sensitiveCheck = document.createElement('input');
        sensitiveCheck.type = 'checkbox';
        sensitiveCheck.checked = this.defaultSensitive;
        sensitiveCheck.addEventListener('change', event => {
            this.defaultSensitive = event.target.checked;
        });
        sensitiveWrap.appendChild(sensitiveCheck);
        const sensitiveText = document.createElement('span');
        sensitiveText.textContent = 'Sensitive';
        sensitiveWrap.appendChild(sensitiveText);
        optionsRow.appendChild(sensitiveWrap);

        const ttlSelect = document.createElement('select');
        ttlSelect.className = 'clipboard-shelf-ttl';
        [
            { label: 'No Expiry', value: 0 },
            { label: '15 min', value: 15 },
            { label: '1 hour', value: 60 },
            { label: '4 hours', value: 240 },
            { label: '24 hours', value: 1440 }
        ].forEach(option => {
            const el = document.createElement('option');
            el.value = String(option.value);
            el.textContent = option.label;
            if (Number(option.value) === this.defaultTtlMinutes) el.selected = true;
            ttlSelect.appendChild(el);
        });
        ttlSelect.addEventListener('change', event => {
            this.defaultTtlMinutes = Number(event.target.value || 0);
        });
        optionsRow.appendChild(ttlSelect);
        composer.appendChild(optionsRow);

        const textarea = document.createElement('textarea');
        textarea.className = 'clipboard-shelf-input';
        textarea.placeholder = 'Type a quick note and press Cmd/Ctrl+Enter to save to shelf...';
        composer.appendChild(textarea);

        const saveNoteBtn = document.createElement('button');
        saveNoteBtn.className = 'btn';
        saveNoteBtn.textContent = 'Save Note';
        saveNoteBtn.onclick = async () => {
            const text = textarea.value;
            if (!text || !text.trim()) {
                this.toast('Type a note first', 'warn');
                return;
            }
            await this.addText(text, 'note', { sensitive: this.defaultSensitive, ttlMinutes: this.defaultTtlMinutes });
            textarea.value = '';
            textarea.focus();
        };
        composer.appendChild(saveNoteBtn);

        textarea.addEventListener('keydown', event => {
            const cmd = event.metaKey || event.ctrlKey;
            if (cmd && event.key === 'Enter') {
                event.preventDefault();
                saveNoteBtn.click();
            }
        });

        const list = document.createElement('div');
        list.className = 'clipboard-shelf-list';
        list.id = 'clipboard-shelf-list';

        panel.appendChild(header);
        panel.appendChild(actions);
        panel.appendChild(composer);
        panel.appendChild(list);

        this.panel = panel;
        this.container.appendChild(panel);
        this.purgeExpired();
        this.renderItems();
    }

    renderItems() {
        if (!this.panel) return;
        const list = this.panel.querySelector('#clipboard-shelf-list');
        if (!list) return;

        list.innerHTML = '';

        const items = this.getVisibleItems();
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'clipboard-shelf-empty';
            empty.textContent = this.searchQuery ? 'No matching items.' : 'No items yet.';
            list.appendChild(empty);
            return;
        }

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'clipboard-shelf-item';

            const headingRow = document.createElement('div');
            headingRow.className = 'clipboard-shelf-item-heading';

            const heading = document.createElement('div');
            heading.className = 'clipboard-shelf-item-title';
            heading.textContent = item.title;
            headingRow.appendChild(heading);

            if (item.pinned) {
                const pinMark = document.createElement('span');
                pinMark.className = 'clipboard-shelf-pin';
                pinMark.textContent = 'PINNED';
                headingRow.appendChild(pinMark);
            }

            if (item.sensitive) {
                const sensitiveMark = document.createElement('span');
                sensitiveMark.className = 'clipboard-shelf-sensitive';
                sensitiveMark.textContent = 'SENSITIVE';
                headingRow.appendChild(sensitiveMark);
            }

            row.appendChild(headingRow);

            const meta = document.createElement('div');
            meta.className = 'clipboard-shelf-item-meta';
            const created = new Date(item.createdAt).toLocaleString();
            const expiry = item.expiresAt ? ` • expires ${new Date(item.expiresAt).toLocaleString()}` : '';
            meta.textContent = `${item.source} • ${created}${expiry}`;
            row.appendChild(meta);

            const preview = document.createElement('pre');
            preview.className = 'clipboard-shelf-item-preview';
            const masked = item.sensitive && this.hideSensitive && !this.revealed.has(item.id);
            if (masked) {
                preview.textContent = '•••••••• (hidden sensitive content)';
                preview.classList.add('masked');
            } else {
                preview.textContent = item.text.length > 500 ? `${item.text.slice(0, 500)}...` : item.text;
            }
            row.appendChild(preview);

            const actions = document.createElement('div');
            actions.className = 'clipboard-shelf-item-actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn';
            copyBtn.textContent = 'Copy';
            copyBtn.onclick = () => this.copyItem(item);
            actions.appendChild(copyBtn);

            if (item.sensitive) {
                const revealBtn = document.createElement('button');
                revealBtn.className = 'btn secondary';
                revealBtn.textContent = this.revealed.has(item.id) ? 'Hide' : 'Reveal';
                revealBtn.onclick = () => this.toggleReveal(item.id);
                actions.appendChild(revealBtn);
            }

            const pinBtn = document.createElement('button');
            pinBtn.className = 'btn secondary';
            pinBtn.textContent = item.pinned ? 'Unpin' : 'Pin';
            pinBtn.onclick = () => this.togglePin(item.id);
            actions.appendChild(pinBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn secondary';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => this.removeItem(item.id);
            actions.appendChild(deleteBtn);

            row.appendChild(actions);
            list.appendChild(row);
        });
    }
}

export const clipboardShelf = new ClipboardShelf();
