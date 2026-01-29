import { generateDiff, normalizeContent } from './normalization.js';

export class NormalizationUI {
    constructor() {
        this.overlay = null;
        this.onAccept = null;
    }

    showDiff(original, onAcceptCallback) {
        const normalized = normalizeContent(original);

        // If unchanged, optional: notify user or just normalize silently?
        // Logic: if manual, show "Already normalized".
        if (original === normalized) {
            alert("Document is already normalized.");
            return;
        }

        this.onAccept = () => {
            onAcceptCallback(normalized);
            this.close();
        };

        const changes = generateDiff(original, normalized);

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'modal-content diff-modal';

        const header = document.createElement('h3');
        header.textContent = 'Normalization Preview';
        modal.appendChild(header);

        const diffContainer = document.createElement('div');
        diffContainer.className = 'diff-container';

        changes.forEach(part => {
            const span = document.createElement('span');
            const color = part.added ? 'diff-add' :
                part.removed ? 'diff-del' : 'diff-same';
            span.className = `diff-line ${color}`;
            span.textContent = part.value;
            diffContainer.appendChild(span);
        });

        modal.appendChild(diffContainer);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn secondary';
        cancelBtn.onclick = () => this.close();

        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept Changes';
        acceptBtn.className = 'btn primary';
        acceptBtn.onclick = () => this.onAccept();

        actions.appendChild(cancelBtn);
        actions.appendChild(acceptBtn);
        modal.appendChild(actions);

        this.overlay.appendChild(modal);
        document.body.appendChild(this.overlay);
    }

    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}

export const normalizationUI = new NormalizationUI();
