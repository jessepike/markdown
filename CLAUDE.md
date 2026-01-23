# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pike Markdown is a desktop markdown editor built with Tauri v2, Vite, and CodeMirror 6. It features a split-pane interface with live preview, synchronized scrolling, and YAML frontmatter rendering.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server with hot reload
npm run tauri dev    # Start Tauri app in development mode
```

### Building
```bash
npm run build        # Build frontend with Vite
npm run tauri build  # Build production Tauri bundle (includes frontend build)
```

### Frontend Only
```bash
npm run preview      # Preview built frontend without Tauri
```

## Architecture

### Frontend Stack
- **CodeMirror 6**: Editor component with markdown language support and custom Zed-inspired theme
- **markdown-it**: Markdown parser with task list plugin support
- **DOMPurify**: Sanitization of rendered HTML
- **Web Workers**: Markdown rendering happens in `render.worker.js` to prevent UI blocking

### Tauri Backend (Rust)
- **Menu System**: Native menus defined in `src-tauri/src/lib.rs` with keyboard shortcuts
- **File Operations**: Uses Tauri plugins for file system, dialog, and OS interactions
- **Launch Handling**: Supports opening `.md` files via file association (double-click to open)
- **State Management**: `LaunchFile` state tracks files opened from OS file associations

### Key Architecture Patterns

**Three-Pane View System**:
- View modes: `editor` (raw), `split` (editor + preview), `preview` (rendered only)
- Toggle via Cmd+P, cycling through modes
- Resizable split pane with drag handle (ratio persisted to localStorage)

**Rendering Pipeline**:
1. Editor content changes trigger `onChange` callback in `editor.js`
2. Content is debounced (250ms normal, 750ms for large files >500KB)
3. For files >1MB, preview pauses automatically (manual refresh with Cmd+R)
4. Content sent to `render.worker.js` via postMessage
5. Worker renders markdown with markdown-it
6. HTML sanitized with DOMPurify in main thread before display

**YAML Frontmatter Handling**:
- Custom parser in `render.worker.js` extracts frontmatter blocks (delimited by `---` or `___`)
- Rendered as styled key-value pairs when "Render Frontmatter" is enabled
- Toggle via View menu (persisted to localStorage as `pike-render-fm`)

**File State Management**:
- `currentFilePath`: Tracks active file for auto-save
- Auto-save triggers on content change (debounced with preview rendering)
- Recent files list (max 10) stored in localStorage (`pike-recent-files`)
- File opened from OS triggers both state update and `file-opened-from-launch` event

**Synchronized Scrolling**:
- Bidirectional scroll sync between editor and preview
- Uses scroll percentage calculation to handle different content heights
- Includes debounce logic to prevent infinite scroll loops
- Toggle via View menu (persisted to localStorage as `pike-sync-scroll`)

**Drag & Drop**:
- Native browser drag/drop events prevented to enable Tauri's `tauri://file-drop` event
- Only accepts `.md`, `.markdown`, `.txt` files

### File Organization

**Frontend** (`src/`):
- `main.js`: Application entry, menu event listeners, file operations, view mode management
- `editor.js`: CodeMirror 6 initialization with custom Zed theme
- `render.worker.js`: Web Worker for markdown rendering (keeps UI responsive)
- `style.css`: Custom CSS including CodeMirror theme variables

**Backend** (`src-tauri/src/`):
- `lib.rs`: Main Rust application, menu system, file launch handling

**Configuration**:
- `tauri.conf.json`: Tauri config including file associations for `.md` and `.markdown`
- `package.json`: Frontend dependencies (CodeMirror, markdown-it, DOMPurify)
- `Cargo.toml`: Rust dependencies (Tauri plugins for fs, dialog, os, window-state)

## Important Implementation Details

**Performance Optimization**:
- Files >500KB use slower debounce (750ms vs 250ms)
- Files >1MB pause live preview (manual refresh only)
- Paused state shown via `.paused-indicator` element

**Keyboard Shortcuts**:
- Cmd+O: Open file
- Cmd+S: Save
- Cmd+Shift+S: Save As
- Cmd+N: New file
- Cmd+P: Toggle preview mode
- Cmd+E: Switch to editor (raw) view
- Cmd+R: Force refresh (useful when preview paused)

**LocalStorage Keys**:
- `pike-recent-files`: Array of recent file paths (max 10)
- `pike-split-ratio`: Editor/preview split percentage
- `pike-view-mode`: Current view mode (editor/split/preview)
- `pike-sync-scroll`: Synchronized scrolling enabled state
- `pike-render-fm`: Render frontmatter enabled state

**AI Artifact Cleanup**:
- Worker strips PUA characters (U+E200...U+E201) used by AI systems for citations
