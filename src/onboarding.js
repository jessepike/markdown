export function showOnboarding() {
    const seen = localStorage.getItem('pike-onboarding-seen');
    if (seen) return;

    // Create Modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-content onboarding-modal';

    modal.innerHTML = `
        <div class="modal-header">
            <h2>Welcome to AgentPad</h2>
        </div>
        <div class="modal-body" style="text-align: center; line-height: 1.6;">
            <p>A fast, beautiful, and distraction-free Markdown editor.</p>
            
            <div style="margin: 20px 0; text-align: left; background: var(--bg-sidebar); padding: 15px; border-radius: 8px;">
                <h3 style="margin-top:0">Key Shortcuts</h3>
                <ul style="padding-left: 20px;">
                    <li><strong>Cmd+O</strong> : Open File</li>
                    <li><strong>Cmd+T</strong> : New Temp Tab</li>
                    <li><strong>Cmd+S</strong> : Save File</li>
                    <li><strong>Cmd+P</strong> : Toggle Preview</li>
                    <li><strong>Cmd+E</strong> : Editor Only</li>
                    <li><strong>Cmd+B</strong> : Toggle Sidebar</li>
                    <li><strong>Cmd+F</strong> : Find & Replace</li>
                    <li><strong>Cmd+Shift+Space</strong> : Jump to Scratchpad</li>
                    <li><strong>Cmd+Shift+K</strong> : Toggle Clipboard Shelf</li>
                    <li><strong>Cmd+Shift+V</strong> : Add Clipboard to Shelf</li>
                    <li><strong>Cmd+Shift+Y</strong> : Add Selection to Shelf</li>
                    <li><strong>Cmd+Shift+J</strong> : Focus Shelf Search</li>
                </ul>
            </div>

            <p>Right-click the editor for more options like Copy as Rich Text.</p>
        </div>
        <div class="modal-footer" style="justify-content: center;">
            <button class="btn primary-btn" id="onboarding-start">Get Started</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event Listener
    document.getElementById('onboarding-start').onclick = () => {
        localStorage.setItem('pike-onboarding-seen', 'true');
        document.body.removeChild(overlay);
    };
}
