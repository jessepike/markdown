export class Tabs {
    constructor() {
        this.element = null;
        this.tabs = []; // Array of { path, name, dirty, closable }
        this.activePath = null;
        this.onSwitch = null;
        this.onClose = null;
    }

    init(container, onSwitch, onClose) {
        this.element = document.createElement('div');
        this.element.className = 'tab-bar';
        this.element.setAttribute('data-tauri-drag-region', 'true');
        this.onSwitch = onSwitch;
        this.onClose = onClose;

        // Insert at the top of the container (editor-pane)
        // Check if there's already a toolbar or if we just prepend
        container.insertBefore(this.element, container.firstChild);
    }

    addTab(path, options = {}) {
        // extract filename from path
        // rudimentary, assumes standard path separators. 
        // For cross platform, better to use a path lib, but string split works for MVP.
        const name = options.name || path.split(/[/\\]/).pop();

        const existing = this.tabs.find(t => t.path === path);
        if (!existing) {
            this.tabs.push({ path, name, dirty: false, closable: options.closable !== false });
        } else {
            existing.name = name;
            existing.closable = options.closable !== false;
        }
        this.render();
        if (options.activate !== false) {
            this.setActive(path);
        }
    }

    removeTab(path) {
        this.tabs = this.tabs.filter(t => t.path !== path);
        this.render();
        // The caller (main.js) is responsible for deciding which tab to switch to
    }

    setActive(path) {
        this.activePath = path;
        this.render();
        // We don't call onSwitch here, assuming this method is called *after* switch logic or *as* switch logic
    }

    setDirty(path, isDirty) {
        const tab = this.tabs.find(t => t.path === path);
        if (tab) {
            tab.dirty = isDirty;
            this.render();
        }
    }

    getTabs() {
        return this.tabs;
    }

    render() {
        this.element.innerHTML = '';
        this.tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = `tab-item ${tab.path === this.activePath ? 'active' : ''}`;
            tabEl.title = tab.path;
            tabEl.setAttribute('data-tauri-drag-region', 'false');

            // Name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'tab-name';
            nameSpan.textContent = tab.name;
            tabEl.appendChild(nameSpan);

            // Dirty Indicator (dot)
            if (tab.dirty) {
                tabEl.classList.add('dirty');
                const dot = document.createElement('span');
                dot.className = 'tab-dirty-dot';
                dot.textContent = '•';
                tabEl.appendChild(dot);
            }

            // Close Button
            if (tab.closable) {
                const closeBtn = document.createElement('span');
                closeBtn.className = 'tab-close';
                closeBtn.innerHTML = '&times;'; // mult symbol
                closeBtn.setAttribute('data-tauri-drag-region', 'false');
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.onClose) this.onClose(tab.path);
                };
                tabEl.appendChild(closeBtn);
            }

            // Click to Switch
            tabEl.onclick = () => {
                if (tab.path !== this.activePath && this.onSwitch) {
                    this.onSwitch(tab.path);
                }
            };

            this.element.appendChild(tabEl);
        });
    }
}

export const tabs = new Tabs();
