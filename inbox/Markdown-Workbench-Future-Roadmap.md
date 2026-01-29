---
title: "Markdown Workbench — Future Roadmap"
version: "1.0"
date: "2026-01-23"
status: "Backlog"
---

# Markdown Workbench — Future Roadmap

## Overview

This document captures features planned for future phases, beyond the current Phase 1 implementation. Items are grouped by theme and roughly ordered by priority within each group.

---

## Phase 2: Workflow Polish

Target: Near-term improvements after Phase 1 ships.

### Export Capabilities
- **HTML Export:** Render document to standalone HTML file with embedded styles
- **PDF Export:** Generate PDF via print dialog or headless rendering
- **Copy as Rich Text:** Copy rendered preview as formatted text for pasting into Word, Google Docs, etc.

### Sanitization Profiles
- Strip HTML comments before copy/export
- Strip YAML frontmatter optionally on copy
- Configurable "profiles" for different output targets (LLM, sharing, archive)

### Enhanced Normalization
- **Heading restructure:** Demote/promote heading levels (e.g., all H1 → H2)
- **Link reference normalization:** Convert inline links to reference-style or vice versa
- **Rule toggles:** Enable/disable individual normalization rules in Preferences

### Additional Tokenizers
- GPT-4 (cl100k_base) tokenizer option
- Toggle between Claude and GPT-4 in Preferences
- Potential: Show both counts simultaneously

### CLI Tool
- `mw normalize <file>` — Apply normalization from command line
- `mw fmt <file>` — Alias for normalize
- `mw tokens <file>` — Output token count
- Enables scripting and batch processing workflows

---

## Phase 3: Git Integration (Read-Only)

Target: Audit trail and version awareness without write operations.

### Git Status Awareness
- Detect if file is in a Git repository
- Show status indicator: Clean / Modified / Untracked / Conflict
- Display in status bar or title bar

### Diff Against HEAD
- View menu option: "Compare with Last Commit"
- Side-by-side or inline diff view
- Read-only — no Git write operations

### File History
- View commit history for current file
- Show author, date, commit message
- "Open at Revision" to view historical versions (read-only)

### Last Modified Info
- Display last commit author and date in document metadata
- Derive from Git history when available

---

## Phase 4: Enterprise Foundations

Target: Features for team/compliance use cases. Larger effort.

### Document Governance Model
- **Status workflow:** Draft → Review → Approved → Archived
- Status stored in YAML frontmatter
- Status changes tracked with timestamps

### YAML Schema Validation
- Define expected frontmatter fields per document type
- Validate on save, show errors for missing/invalid fields
- Schema definitions in `.mdw/schemas/` directory

### Dual-Hash Integrity
- `content_hash`: SHA256 of document body (normalized)
- `governance_hash`: Hash of governance metadata fields
- Detect tampering or out-of-band edits

### Approval Logging
- Record approvals in frontmatter `approval_log` array
- Each entry: approver, timestamp, optional comment
- Requires governance workflow to be meaningful

---

## Phase 5: Enterprise Advanced

Target: Full governance capabilities. Significant complexity.

### Roles and Permissions
- Define roles: Reader, Editor, Reviewer, Approver
- Map Git identities to roles via config file
- Enforce permissions (advisory or blocking mode)

### Identity Resolution
- Map multiple Git emails to single user identity
- Support aliases (e.g., old email addresses)
- Display resolved identity in UI

### Governance Auto-Commit
- Automatically commit governance field changes to Git
- Separate "governance" commits from content commits
- Respects GPG signing and pre-commit hooks

### Inline Comments
- Add comments anchored to specific text locations
- Comments stored as HTML comments in markdown
- Re-anchoring logic when surrounding text changes
- Strip comments on export (configurable)

### Directive Blocks
- Custom block syntax: `:::agent`, `:::disclosure`, `:::snippet`
- Parsed and rendered specially in preview
- Agent blocks stripped on export
- Note: Non-standard markdown extension

---

## Phase 6: Platform Expansion

Target: Broader reach and collaboration.

### Web Viewer
- Read-only web-based viewer for sharing documents
- Respects sanitization profiles
- No editing capability (keeps scope manageable)

### Windows/Linux Support
- Tauri already cross-platform capable
- Requires testing and platform-specific adjustments
- Native menu bar handling per platform

### Sync/Cloud Integration
- iCloud Drive awareness
- Dropbox/Google Drive detection (local sync folders)
- No direct API integration — file-based only

---

## Explicitly Deferred (No Current Plans)

These items have been considered but are not on the roadmap:

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Complexity, requires server infrastructure |
| Plugin/extension API | Premature — need stable core first |
| WASM validators | Over-engineering for current scope |
| Multi-document bundles | Unclear use case |
| Direct Google Docs API | OAuth complexity, Google's API churn |
| Go engine rewrite | Current JS architecture performs well |
| Mobile apps | Desktop-first focus |
| Advanced LLM Integration (actually chatting/streaming within the app?)
| Multi-file management / improved Sidebar?
| Search & Replace?
| Plugin system?

---

## Revision History

| Date | Change |
|------|--------|
| 2026-01-23 | Initial roadmap created from synthesis of spec v0.6, product brief, and architecture discussions |
