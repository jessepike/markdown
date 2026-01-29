export class ReloadPromptUI {
    constructor() {
        this.overlay = null;
        this.onConfirm = null;
        this.isOpen = false;
    }

    show(fileName, onConfirmCallback, hasUnsavedChanges = true) {
        if (this.isOpen) return; // Prevent stacking

        this.onConfirm = () => {
            onConfirmCallback();
            this.close();
        };

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.onclick = (e) => {
            if (e.target === this.overlay) this.close();
        };

        const modal = document.createElement('div');
        modal.className = 'modal-content';

        const title = document.createElement('h3');
        title.textContent = 'File Changed';
        modal.appendChild(title);

        const msg = document.createElement('p');
        const warning = hasUnsavedChanges
            ? ' Unsaved changes in the editor will be lost.'
            : '';
        msg.textContent = `The file "${fileName}" has changed on disk. Do you want to reload it?${warning}`;
        msg.style.marginBottom = '20px';
        msg.style.lineHeight = '1.5';
        msg.style.color = 'var(--text-main)';
        modal.appendChild(msg);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Keep Editor Version';
        cancelBtn.className = 'btn secondary';
        cancelBtn.onclick = () => this.close();

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Reload from Disk';
        confirmBtn.className = 'btn primary';
        confirmBtn.style.background = '#e06c75'; // Red warning color
        confirmBtn.style.borderColor = '#e06c75';
        confirmBtn.onclick = () => this.onConfirm();

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        modal.appendChild(actions);

        this.overlay.appendChild(modal);
        document.body.appendChild(this.overlay);
        this.isOpen = true;
    }

    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.isOpen = false;
        }
    }
}

export const reloadPromptUI = new ReloadPromptUI();
