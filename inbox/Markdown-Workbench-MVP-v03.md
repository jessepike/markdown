---
title: "Markdown Workbench — MVP Specification"
version: "0.3-mvp"
status: "draft"
updated: "2026-01-22"
---

# Markdown Workbench MVP

## Philosophy

Notepad, but beautiful. Opens instantly, saves automatically, looks like Zed.

---

## Features (v0.1)

| Feature | Behavior |
|---------|----------|
| Single pane | Editor or preview (toggle) |
| Live preview | Debounced, worker-parsed |
| Auto-save | 500ms debounce, on blur |
| GFM | Tables + task lists |
| Zed aesthetic | One Dark, minimal chrome |

---

## Architecture

```
┌─────────────────────────────────────────┐
│ Tauri (Rust)                            │
│ └── File I/O, window management         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ WebView                                 │
│                                         │
│  ┌──────────────┐    ┌───────────────┐  │
│  │ CodeMirror 6 │───►│ Web Worker    │  │
│  │ (editor)     │    │ (markdown-it) │  │
│  └──────────────┘    └───────┬───────┘  │
│                              │          │
│                      ┌───────▼───────┐  │
│                      │ Sanitized HTML│  │
│                      │ (preview)     │  │
│                      └───────────────┘  │
└─────────────────────────────────────────┘
```

---

## Live Preview

### Render Pipeline

```
keystroke → debounce(250ms) → worker.postMessage(markdown)
                                      │
                                      ▼
                              markdown-it.render()
                                      │
                                      ▼
                              sanitizeHTML()
                                      │
                                      ▼
                              postMessage(html) → preview.innerHTML
```

### Debounce Rules

| Trigger | Delay |
|---------|-------|
| Typing | 250ms after last keystroke |
| Paste | Immediate |
| Cmd+S | Immediate |
| File open | Immediate |

### Large File Handling

| Condition | Behavior |
|-----------|----------|
| >500KB or >10k lines | Debounce → 750ms |
| >1MB | Pause preview while typing, show "Cmd+R to refresh" |

### GFM Support

Enabled:
- Tables
- Task lists `- [x]`
- Strikethrough
- Autolinks

Disabled (for now):
- Footnotes
- Custom containers

### HTML Handling

**Sanitize all inline HTML.** Use DOMPurify or similar.

No raw `<script>`, `<iframe>`, event handlers.

---

## UI Model

### Default: Single Pane + Toggle

```
┌──────────────────────────────────────┐
│ [filename.md]           [👁] [—][×] │
├──────────────────────────────────────┤
│                                      │
│   Editor OR Preview                  │
│   (Cmd+P to toggle)                  │
│                                      │
└──────────────────────────────────────┘
```

- `[👁]` button toggles preview
- Preview is live even when viewing (updates in background)

### Split Pane (v0.2)

Deferred. Single pane keeps UI simple.

### Scroll Sync

**None for v0.1.** Preview scroll is independent.

Future: "Scroll to cursor" command.

---

## Settings

Only two:

| Setting | Options | Default |
|---------|---------|---------|
| Live Preview | On / Off | On |
| Update Speed | Normal / Slow | Normal |

Normal = 250ms. Slow = 750ms.

Everything else is internal.

---

## Stack

| Layer | Tech |
|-------|------|
| Shell | Tauri 2.x |
| Editor | CodeMirror 6 |
| Renderer | markdown-it (in Web Worker) |
| Sanitizer | DOMPurify |
| Fonts | Inter, JetBrains Mono |

---

## Theme

```css
:root {
  --bg-app:      #1e2227;
  --bg-editor:   #23272e;
  --text-main:   #abb2bf;
  --text-muted:  #5c6370;
  --border:      #3b4048;
  --accent:      #61afef;
  --font-ui:     'Inter', system-ui;
  --font-mono:   'JetBrains Mono', monospace;
}
```

---

## Shortcuts

| Key | Action |
|-----|--------|
| Cmd+O | Open |
| Cmd+S | Save + render |
| Cmd+P | Toggle preview |
| Cmd+R | Force render (large file mode) |
| Cmd+W | Close |
| Cmd+Q | Quit |

---

## File Structure

```
markdown-workbench/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.js           # App init
│   ├── editor.js         # CodeMirror setup
│   ├── preview.js        # Preview pane
│   ├── render.worker.js  # markdown-it in worker
│   ├── style.css         # Zed theme
│   └── titlebar.js       # Window controls
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        └── main.rs       # File I/O
```

---

## package.json

```json
{
  "name": "markdown-workbench",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@codemirror/lang-markdown": "^6.2.0",
    "@codemirror/state": "^6.4.0",
    "@codemirror/view": "^6.26.0",
    "codemirror": "^6.0.1",
    "dompurify": "^3.0.0",
    "markdown-it": "^14.0.0",
    "markdown-it-task-lists": "^2.1.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "vite": "^5.0.0"
  }
}
```

---

## Build Plan

| Week | Deliverable |
|------|-------------|
| 1 | Tauri shell, file open, CodeMirror |
| 2 | Web Worker + markdown-it + sanitize |
| 3 | Toggle UI, debounce, large file handling |
| 4 | Polish, settings, package |

---

## Out of Scope (v0.1)

- Split pane
- Scroll sync
- File tree
- Tabs
- Search
- Export
- Git
- Governance

---

## Success Criteria

1. Opens .md file in <100ms
2. Typing feels instant (no jank)
3. Preview updates smoothly
4. Looks like Zed
5. Binary <10MB
