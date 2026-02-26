import { invoke } from '@tauri-apps/api/core';

export class Sidebar {
    constructor(container, onFileSelect) {
        this.container = container;
        this.onFileSelect = onFileSelect;
        this.rootPath = null;
        this.tree = document.createElement('div');
        this.tree.className = 'file-tree';
        this.container.appendChild(this.tree);

        // Initial Empty State
        this.renderEmpty();
    }

    renderEmpty() {
        this.tree.innerHTML = '<div class="empty-message">No folder open.</div>';
    }

    async setRoot(path) {
        this.rootPath = path;
        this.tree.innerHTML = ''; // Clear
        await this.loadDirectory(path, this.tree, 0);
    }

    async loadDirectory(path, parentElement, depth) {
        try {
            const entries = await invoke('read_dir', { path });

            entries.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.style.paddingLeft = `${depth * 16 + 12}px`;

                const icon = document.createElement('span');
                icon.className = 'file-icon';

                const label = document.createElement('span');
                label.textContent = entry.name;

                item.appendChild(icon);
                item.appendChild(label);

                if (entry.is_dir) {
                    item.classList.add('is-dir');
                    icon.innerHTML = '📁'; // Simplified

                    // Container for children (hidden by default)
                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'file-children hidden';

                    item.onclick = async (e) => {
                        e.stopPropagation();
                        if (childrenContainer.children.length === 0) {
                            // Lazy load
                            await this.loadDirectory(entry.path, childrenContainer, depth + 1);
                        }
                        childrenContainer.classList.toggle('hidden');
                        item.classList.toggle('expanded');
                        const isExpanded = item.classList.contains('expanded');
                        icon.innerHTML = isExpanded ? '📂' : '📁';
                    };

                    parentElement.appendChild(item);
                    parentElement.appendChild(childrenContainer);
                } else {
                    item.classList.add('is-file');
                    icon.innerHTML = '📄';

                    item.onclick = (e) => {
                        e.stopPropagation();
                        // Highlight selection
                        const prev = this.tree.querySelector('.file-item.active');
                        if (prev) prev.classList.remove('active');
                        item.classList.add('active');

                        this.onFileSelect(entry.path);
                    };

                    parentElement.appendChild(item);
                }
            });

            if (entries.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'file-item empty-folder';
                empty.textContent = '(empty)';
                empty.style.paddingLeft = `${depth * 16 + 12}px`;
                parentElement.appendChild(empty);
            }

        } catch (error) {
            console.error('Failed to read dir:', path, error);
            const errDiv = document.createElement('div');
            errDiv.className = 'error-item';
            errDiv.textContent = 'Error loading';
            parentElement.appendChild(errDiv);
        }
    }
}
