export class Tabs {
    constructor() {
        this.element = null;
        this.scroller = null;
        this.wrapper = null;
        this.overflowBtn = null;
        this.overflowMenu = null;
        this.tabs = []; // Array of { path, name, dirty, closable }
        this.activePath = null;
        this.onSwitch = null;
        this.onClose = null;
    }

    init(container, onSwitch, onClose) {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'tab-strip';
        this.wrapper.setAttribute('data-tauri-drag-region', 'true');

        const leftBtn = document.createElement('button');
        leftBtn.type = 'button';
        leftBtn.className = 'tab-scroll-btn';
        leftBtn.textContent = '‹';
        leftBtn.title = 'Scroll tabs left';
        leftBtn.setAttribute('data-tauri-drag-region', 'false');
        leftBtn.onclick = () => this.scrollTabs(-180);

        this.scroller = document.createElement('div');
        this.scroller.className = 'tab-bar-scroll';
        this.scroller.setAttribute('data-tauri-drag-region', 'true');

        this.element = document.createElement('div');
        this.element.className = 'tab-bar';
        this.element.setAttribute('data-tauri-drag-region', 'true');

        this.overflowBtn = document.createElement('button');
        this.overflowBtn.type = 'button';
        this.overflowBtn.className = 'tab-scroll-btn overflow';
        this.overflowBtn.textContent = '⋯';
        this.overflowBtn.title = 'Open tabs menu';
        this.overflowBtn.setAttribute('data-tauri-drag-region', 'false');
        this.overflowBtn.onclick = () => {
            this.overflowMenu.classList.toggle('visible');
        };

        this.overflowMenu = document.createElement('div');
        this.overflowMenu.className = 'tab-overflow-menu';
        this.overflowMenu.setAttribute('data-tauri-drag-region', 'false');

        this.onSwitch = onSwitch;
        this.onClose = onClose;

        this.scroller.appendChild(this.element);
        this.wrapper.appendChild(leftBtn);
        this.wrapper.appendChild(this.scroller);
        this.wrapper.appendChild(this.overflowBtn);
        this.wrapper.appendChild(this.overflowMenu);

        document.addEventListener('click', (event) => {
            if (!this.wrapper?.contains(event.target)) {
                this.overflowMenu?.classList.remove('visible');
            }
        });

        container.insertBefore(this.wrapper, container.firstChild);
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
        this.overflowMenu.innerHTML = '';
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

            const overflowItem = document.createElement('button');
            overflowItem.type = 'button';
            overflowItem.className = 'tab-overflow-item';
            overflowItem.textContent = tab.name;
            overflowItem.title = tab.path;
            overflowItem.onclick = () => {
                this.overflowMenu.classList.remove('visible');
                if (this.onSwitch) this.onSwitch(tab.path);
            };

            if (tab.closable) {
                const closeLabel = document.createElement('span');
                closeLabel.className = 'tab-overflow-close';
                closeLabel.textContent = '×';
                closeLabel.onclick = (e) => {
                    e.stopPropagation();
                    this.overflowMenu.classList.remove('visible');
                    if (this.onClose) this.onClose(tab.path);
                };
                overflowItem.appendChild(closeLabel);
            }

            this.overflowMenu.appendChild(overflowItem);
        });
    }

    scrollTabs(delta) {
        this.scroller?.scrollBy({ left: delta, behavior: 'smooth' });
    }
}

export const tabs = new Tabs();
