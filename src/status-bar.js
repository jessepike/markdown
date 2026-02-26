export class StatusBar {
    constructor() {
        this.element = null;
        this.tokenEl = null;
        this.cursorEl = null;
    }

    init(container, onSidebarToggle, onSearchToggle) {
        this.element = document.createElement('div');
        this.element.className = 'status-bar';

        // Left Actions Group (Sidebar, Search)
        const leftActions = document.createElement('div');
        leftActions.className = 'status-group';

        // Sidebar Toggle
        const sidebarToggle = document.createElement('div');
        sidebarToggle.className = 'status-item clickable';
        sidebarToggle.title = 'Toggle Sidebar (Cmd+B)';
        sidebarToggle.onclick = onSidebarToggle;
        sidebarToggle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
        leftActions.appendChild(sidebarToggle);

        // Search Toggle
        const searchToggle = document.createElement('div');
        searchToggle.className = 'status-item clickable';
        searchToggle.title = 'Find & Replace (Cmd+F)';
        searchToggle.onclick = onSearchToggle;
        searchToggle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
        leftActions.appendChild(searchToggle);

        this.element.appendChild(leftActions);

        // Left Group (Tokens)
        const leftGroup = document.createElement('div');
        leftGroup.className = 'status-group';

        // Token Count
        const tokenItem = document.createElement('div');
        tokenItem.className = 'status-item';
        tokenItem.innerHTML = `<span class="status-value" id="status-tokens">0</span> <span class="status-label">tokens</span> <span class="status-divider">|</span> <span class="status-value" id="status-words">0</span> <span class="status-label">words</span>`;
        leftGroup.appendChild(tokenItem);
        this.tokenEl = tokenItem.querySelector('#status-tokens');
        this.wordEl = tokenItem.querySelector('#status-words');

        this.element.appendChild(leftGroup);

        // Right Group (Cursor)
        const rightGroup = document.createElement('div');
        rightGroup.className = 'status-group';

        const cursorItem = document.createElement('div');
        cursorItem.className = 'status-item';
        cursorItem.textContent = 'Ln 1, Col 1';
        rightGroup.appendChild(cursorItem);
        this.cursorEl = cursorItem;

        this.element.appendChild(rightGroup);

        // Append to Body to sit below #app (flex column layout)
        document.body.appendChild(this.element);

    }

    updateTokens(count, words) {
        if (this.tokenEl) {
            this.tokenEl.textContent = typeof count === 'number' ? count.toLocaleString() : count;
        }
        if (this.wordEl && typeof words === 'number') {
            this.wordEl.textContent = words.toLocaleString();
        }
    }

    updateCursor(line, col) {
        if (this.cursorEl) this.cursorEl.textContent = `Ln ${line}, Col ${col}`;
    }
}

export const statusBar = new StatusBar();
