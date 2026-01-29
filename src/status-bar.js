import { prefs } from './preferences.js';

export class StatusBar {
    constructor() {
        this.element = null;
        this.tokenEl = null;
        this.cursorEl = null;
        this.normEl = null;
    }

    init(container) {
        this.element = document.createElement('div');
        this.element.className = 'status-bar';

        // Left Group (Tokens, Normalization)
        const leftGroup = document.createElement('div');
        leftGroup.className = 'status-group';

        // Token Count
        const tokenItem = document.createElement('div');
        tokenItem.className = 'status-item';
        tokenItem.innerHTML = `<span class="status-value" id="status-tokens">0</span> <span class="status-label">tokens (Claude)</span>`;
        leftGroup.appendChild(tokenItem);
        this.tokenEl = tokenItem.querySelector('#status-tokens');

        // Normalization Mode
        const normItem = document.createElement('div');
        normItem.className = 'status-item clickable';
        normItem.title = 'Click to toggle Normalization Mode';
        normItem.onclick = () => this.cycleNormalization();
        normItem.innerHTML = `<span class="status-label">Norm:</span> <span class="status-value" id="status-norm">Auto</span>`;
        leftGroup.appendChild(normItem);
        this.normEl = normItem.querySelector('#status-norm');

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

        // Subscribe to prefs to update norm label
        prefs.subscribe(settings => {
            this.updateNormLabel(settings.normalizationMode);
        });

        // Init label
        this.updateNormLabel(prefs.get('normalizationMode'));
    }

    updateTokens(count) {
        if (this.tokenEl) {
            this.tokenEl.textContent = typeof count === 'number' ? count.toLocaleString() : count;
        }
    }

    updateCursor(line, col) {
        if (this.cursorEl) this.cursorEl.textContent = `Ln ${line}, Col ${col}`;
    }

    updateNormLabel(mode) {
        if (this.normEl) {
            this.normEl.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        }
    }

    cycleNormalization() {
        const modes = ['off', 'manual', 'auto'];
        const current = prefs.get('normalizationMode');
        const idx = modes.indexOf(current);
        const next = modes[(idx + 1) % modes.length];
        prefs.set('normalizationMode', next);
    }
}

export const statusBar = new StatusBar();
