---
title: "Markdown Workbench — Phase 1 Implementation Brief"
version: "1.0"
date: "2026-01-23"
status: "Ready for Implementation"
baseline: "v0.2.0 (current working build)"
---

# Markdown Workbench — Phase 1 Implementation Brief

## Overview

This document defines the features to be implemented in Phase 1, building on the existing v0.2.0 baseline. The focus is on **LLM workflow efficiency**: making it fast to clean, count, and copy markdown for AI ingestion.

### What's Already Built (v0.2.0 Baseline)

- Dual-pane editor with three view modes (editor, split, preview)
- Bidirectional synchronized scrolling
- Full file operations (New, Open, Save, Save As, Recent Files)
- YAML frontmatter detection and toggle rendering
- CommonMark + GFM preview via markdown-it
- Web Worker rendering for performance
- Large file handling (adaptive debounce, preview pause >1MB)
- Native macOS menu bar with keyboard shortcuts
- Drag & drop support for .md, .markdown, .txt files

---

## Phase 1 Features

### 1. Preferences System

**Purpose:** Centralized settings management with GUI access.

**Requirements:**
- Preferences accessible via App Menu → Preferences (Cmd+,)
- Modal dialog with organized settings sections
- Settings persisted to `settings.json` in app config directory
- No manual JSON editing required — all settings configurable via UI

**Settings to Include:**
- Normalization mode (Off / Manual / Auto)
- Default XML wrapper tag name
- Editor font size
- Theme selection (if applicable)
- Synchronized scrolling default (on/off)
- Frontmatter rendering default (on/off)

**Technical Notes:**
- Use Tauri's `app.path.appConfigDir()` for config location
- Load settings on app start, apply defaults if file missing
- Save on change (debounced)

---

### 2. Token Counter

**Purpose:** Display accurate token count for LLM context window planning.

**Requirements:**
- Display token count in status bar at bottom of window
- Use Claude tokenizer for accuracy
- Update count on content change (debounced, same timing as preview)
- Label clearly as "tokens" with Claude attribution
- Handle large files gracefully (show "calculating..." during computation)

**UI Location:**
```
┌─────────────────────────────────────────────────┐
│  Status Bar                                     │
│  ├─ ~2,847 tokens (Claude)                      │
│  ├─ Normalization: Auto ▼                       │
│  └─ Ln 42, Col 8                                │
└─────────────────────────────────────────────────┘
```

**Technical Notes:**
- Use `@anthropic-ai/tokenizer` npm package (or equivalent)
- Run tokenization in Web Worker to avoid blocking UI
- Cache result until content changes

---

### 3. Normalization Engine

**Purpose:** Clean and standardize markdown for consistent LLM ingestion.

**Requirements:**

#### 3.1 Trigger Modes
- **Off:** Normalization disabled entirely
- **Manual:** User triggers via Edit menu → Normalize (Cmd+Shift+N)
- **Auto:** Normalize automatically on paste and file open

#### 3.2 Diff Preview
- Before applying normalization, show diff of proposed changes
- User can Accept or Cancel
- If Cancel, document unchanged
- Diff view should clearly highlight additions/removals

#### 3.3 Normalization Rules (v1 Scope)

| Rule | Transform | Notes |
|------|-----------|-------|
| Trailing whitespace | Remove from all lines | Safe, no semantic change |
| Line endings | Normalize to LF | Cross-platform consistency |
| Excessive blank lines | Collapse to max 2 | Preserve paragraph breaks |
| Code fence style | Standardize to triple backtick (```) | Convert `~~~` to ``` |
| List indentation | Normalize to 2-space indent | GFM standard |
| Table alignment | Align pipe characters | GFM table formatting |
| Final newline | Ensure single trailing newline | File hygiene |

#### 3.4 Guarantees
- **Idempotent:** Running normalize twice produces same result as once
- **Semantic preservation:** Content meaning unchanged
- **Reversible:** User can undo (Cmd+Z) after accepting

**Technical Notes:**
- Implement at token/line level (no AST rewrite needed for v1 rules)
- Rules should be individually toggleable in future versions
- Consider extracting to separate module for potential CLI use

---

### 4. Copy with XML Wrapper

**Purpose:** Wrap content in XML tags for clean LLM ingestion.

**Requirements:**
- Menu item: Edit → Copy for LLM (Cmd+Shift+C)
- Wraps entire document (or selection) in configurable XML tags
- Default wrapper: `<document>...</document>`
- Wrapper tag name configurable in Preferences
- Copies to clipboard (does not modify file)

**Output Format:**
```xml
<document>
# Your Markdown Content

All the content goes here...
</document>
```

**Options (in Preferences):**
- Wrapper tag name (default: "document")
- Include/exclude YAML frontmatter in wrapped copy

---

### 5. File System Watcher

**Purpose:** Auto-reload document when file changes externally.

**Requirements:**
- Detect when currently open file is modified by another application
- Show non-intrusive notification: "File changed on disk. Reload?"
- Options: [Reload] [Ignore] [Always Reload]
- "Always Reload" preference persisted in settings
- If document has unsaved changes, warn before reload

**Technical Notes:**
- Use Tauri's file system watcher API (Rust `notify` crate)
- Debounce rapid changes (e.g., 500ms)
- Only watch currently open file, not directory

---

### 6. Status Bar

**Purpose:** Display document metadata and quick controls.

**Requirements:**
- Fixed bar at bottom of editor window
- Display elements (left to right):
  - Token count (Claude)
  - Normalization mode indicator (clickable to toggle)
  - Cursor position (Ln X, Col Y)
- Normalization indicator shows current mode and allows quick toggle

**Behavior:**
- Clicking normalization indicator cycles through: Off → Manual → Auto → Off
- Token count updates on content change
- Cursor position updates on selection change

---

## Menu Updates

### Edit Menu (Updated)
```
Edit
├─ Undo                    Cmd+Z
├─ Redo                    Cmd+Shift+Z
├─ ─────────────────────
├─ Cut                     Cmd+X
├─ Copy                    Cmd+C
├─ Copy for LLM            Cmd+Shift+C    [NEW]
├─ Paste                   Cmd+V
├─ Select All              Cmd+A
├─ ─────────────────────
├─ Normalize               Cmd+Shift+N    [NEW]
```

### App Menu (Updated)
```
Markdown Workbench
├─ About Markdown Workbench
├─ ─────────────────────
├─ Preferences...          Cmd+,          [NEW]
├─ ─────────────────────
├─ Quit                    Cmd+Q
```

---

## Acceptance Criteria

### Preferences
- [ ] Cmd+, opens Preferences modal
- [ ] All settings persist across app restarts
- [ ] Invalid settings.json gracefully falls back to defaults

### Token Counter
- [ ] Displays accurate Claude token count
- [ ] Updates within 500ms of typing pause
- [ ] Shows placeholder during calculation for large files

### Normalization
- [ ] Manual trigger works via menu and keyboard shortcut
- [ ] Auto mode normalizes on paste (when enabled)
- [ ] Diff preview shows before any changes applied
- [ ] Cancel leaves document unchanged
- [ ] All v1 rules implemented and tested
- [ ] Normalize is idempotent

### Copy for LLM
- [ ] Copies wrapped content to clipboard
- [ ] Wrapper tag configurable in Preferences
- [ ] Works with selection (partial document)

### File Watcher
- [ ] Detects external file changes
- [ ] Prompts user before reloading
- [ ] Respects "Always Reload" preference
- [ ] Warns if unsaved local changes exist

### Status Bar
- [ ] Token count displays and updates
- [ ] Normalization mode clickable and toggles
- [ ] Cursor position accurate

---

## Out of Scope (Phase 1)

The following are explicitly **not** included in Phase 1:

- Export (HTML/PDF/DOCX)
- Git integration
- Governance workflow (Draft/Review/Approved states)
- Roles and permissions
- CLI tools
- Structural normalization (heading restructure, section reordering)
- Multiple tokenizer options
- Plugin system

These items are documented in the Future Roadmap.

---

## Implementation Order

Recommended sequence based on dependencies:

1. **Preferences System** — Other features depend on persisted settings
2. **Status Bar** — Container for token count and normalization indicator
3. **Token Counter** — Independent, can be built in parallel
4. **Normalization Engine** — Core feature, builds on preferences
5. **Copy for LLM** — Builds on normalization and preferences
6. **File System Watcher** — Independent, can be built in parallel

Items 3 and 6 can be developed in parallel with the main sequence.
