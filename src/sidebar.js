import { invoke } from '@tauri-apps/api/core';

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function formatTimeLabel(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '';
    }
}

export class Sidebar {
    constructor(container, handlers = {}) {
        this.container = container;
        this.handlers = handlers;
        this.rootPath = null;
        this.state = {
            clips: [],
            prompts: [],
            recentFiles: [],
            tempTabs: []
        };
        this.expanded = {
            clips: true,
            prompts: true,
            recent: true,
            tempTabs: true,
            files: true
        };

        this.tree = el('div', 'file-tree');
        this.container.appendChild(this.tree);
        this.render();
    }

    setHandlers(handlers) {
        this.handlers = handlers || {};
    }

    setData(partialState) {
        this.state = {
            ...this.state,
            ...partialState
        };
        this.render();
    }

    async setRoot(path) {
        this.rootPath = path || null;
        this.render();
    }

    render() {
        this.tree.innerHTML = '';

        this.renderSection(
            'clips',
            `Clips (${this.state.clips.length})`,
            this.state.clips,
            (clip) => {
                const row = el('button', 'sidebar-item sidebar-entry');
                row.title = clip.title || 'Clip';
                row.type = 'button';

                const title = el('div', 'sidebar-entry-title', clip.title || 'Untitled clip');
                const meta = el('div', 'sidebar-entry-meta', formatTimeLabel(clip.createdAt));
                row.appendChild(title);
                row.appendChild(meta);
                row.addEventListener('click', () => this.handlers.onClipSelect?.(clip));
                return row;
            },
            'No clips yet. Use Shelf or Cmd/Ctrl+Shift+V.'
        );

        this.renderSection(
            'prompts',
            `Prompts (${this.state.prompts.length})`,
            this.state.prompts,
            (prompt) => {
                const row = el('button', 'sidebar-item sidebar-entry');
                row.type = 'button';
                row.title = prompt.title || 'Prompt';

                const title = el('div', 'sidebar-entry-title', prompt.title || 'Untitled prompt');
                const meta = el('div', 'sidebar-entry-meta', formatTimeLabel(prompt.updatedAt || prompt.createdAt));
                row.appendChild(title);
                row.appendChild(meta);
                row.addEventListener('click', () => this.handlers.onPromptSelect?.(prompt));
                return row;
            },
            'No prompts yet. Save one from selected text.'
        );

        this.renderSection(
            'tempTabs',
            `Temp Tabs (${this.state.tempTabs.length})`,
            this.state.tempTabs,
            (tab) => {
                const row = el('button', 'sidebar-item sidebar-recent-file');
                row.type = 'button';
                row.title = tab.path;
                row.textContent = tab.displayName || 'Temp';
                row.addEventListener('click', () => this.handlers.onTempTabSelect?.(tab.path));
                return row;
            },
            'No temp tabs.'
        );

        this.renderSection(
            'recent',
            `Recent Files (${this.state.recentFiles.length})`,
            this.state.recentFiles,
            (path) => {
                const row = el('button', 'sidebar-item sidebar-recent-file');
                row.type = 'button';
                row.title = path;
                row.textContent = path.split(/[/\\]/).pop() || path;
                row.addEventListener('click', () => this.handlers.onFileSelect?.(path));
                return row;
            },
            'No recent files.'
        );

        this.renderFileSection();
    }

    renderSection(key, title, items, renderItem, emptyText) {
        const section = el('div', 'sidebar-section');
        const header = el('button', 'sidebar-section-header');
        header.type = 'button';
        header.textContent = this.expanded[key] ? `▾ ${title}` : `▸ ${title}`;
        header.addEventListener('click', () => {
            this.expanded[key] = !this.expanded[key];
            this.render();
        });

        section.appendChild(header);

        if (this.expanded[key]) {
            const body = el('div', 'sidebar-section-body');
            if (!items || items.length === 0) {
                body.appendChild(el('div', 'sidebar-empty', emptyText));
            } else {
                items.forEach(item => body.appendChild(renderItem(item)));
            }
            section.appendChild(body);
        }

        this.tree.appendChild(section);
    }

    renderFileSection() {
        const title = this.rootPath
            ? `Folder: ${this.rootPath.split(/[/\\]/).pop()}`
            : 'Folder Files';

        const section = el('div', 'sidebar-section');
        const header = el('button', 'sidebar-section-header');
        header.type = 'button';
        header.textContent = this.expanded.files ? `▾ ${title}` : `▸ ${title}`;
        header.addEventListener('click', () => {
            this.expanded.files = !this.expanded.files;
            this.render();
        });
        section.appendChild(header);

        if (this.expanded.files) {
            const body = el('div', 'sidebar-section-body');
            if (!this.rootPath) {
                body.appendChild(el('div', 'sidebar-empty', 'No folder open.'));
            } else {
                this.renderDirectory(this.rootPath, body, 0);
            }
            section.appendChild(body);
        }

        this.tree.appendChild(section);
    }

    async renderDirectory(path, parentElement, depth) {
        try {
            const entries = await invoke('read_dir', { path });
            entries.forEach(entry => {
                const item = el('button', 'sidebar-item sidebar-file-item');
                item.type = 'button';
                item.style.paddingLeft = `${depth * 14 + 12}px`;

                const icon = el('span', 'file-icon', entry.is_dir ? '▸' : '•');
                const label = el('span', 'sidebar-file-label', entry.name);
                item.appendChild(icon);
                item.appendChild(label);

                if (entry.is_dir) {
                    item.classList.add('is-dir');
                    const childrenContainer = el('div', 'file-children hidden');
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (childrenContainer.children.length === 0) {
                            await this.renderDirectory(entry.path, childrenContainer, depth + 1);
                        }
                        childrenContainer.classList.toggle('hidden');
                        const isExpanded = !childrenContainer.classList.contains('hidden');
                        icon.textContent = isExpanded ? '▾' : '▸';
                    });
                    parentElement.appendChild(item);
                    parentElement.appendChild(childrenContainer);
                } else {
                    item.classList.add('is-file');
                    item.title = entry.path;
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.handlers.onFileSelect?.(entry.path);
                    });
                    parentElement.appendChild(item);
                }
            });

            if (!entries.length) {
                const empty = el('div', 'sidebar-empty');
                empty.textContent = '(empty)';
                empty.style.paddingLeft = `${depth * 14 + 12}px`;
                parentElement.appendChild(empty);
            }
        } catch (error) {
            console.error('Failed to read directory:', path, error);
            parentElement.appendChild(el('div', 'sidebar-empty sidebar-error', 'Error loading folder'));
        }
    }
}
