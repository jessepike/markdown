# AgentPad — Backlog

## Priority: High (Distribution Readiness)

### DOCX Export
- Export markdown to `.docx` format
- Critical for non-technical users bridging markdown to Word/Google Docs
- Evaluate libraries: `docx` (npm), `pandoc` (system dependency), or html-to-docx conversion

### Light Theme
- Add a light color scheme as default or toggle
- Dark-only is a barrier for casual/non-technical users
- Consider system preference detection (`prefers-color-scheme`)

### Word Count
- Display word count alongside (or instead of) token count in status bar
- Non-technical users expect word count; tokens are meaningless to them
- Token count can remain as a toggle or secondary display

### Spell Check
- Enable browser/system spell check in the editor
- CodeMirror 6 disables native spellcheck by default — needs explicit opt-in via `EditorView.contentAttributes`

### Simple Onboarding Flow
- First-launch experience explaining key features
- Brief walkthrough: view modes, scratch tabs, shelf, export
- Keep it minimal — 3-4 steps max, dismissible, don't show again

## Priority: Medium (Polish)

### PDF Export Improvements
- Dedicated export flow instead of browser print dialog
- Page size, margin, and header/footer options

### Paste Markdown as Rich Text
- Detect markdown in clipboard on paste into external apps
- Complements existing "Copy as Rich Text" feature

## Ideas (Unscoped)

### Menubar Conversion Utility (Separate Product)
- Standalone macOS menubar app
- Clipboard watcher for markdown content
- One-click convert to rich text, PDF, DOCX
- Small preview/edit popup before export
- Separate repo, separate scope from AgentPad
