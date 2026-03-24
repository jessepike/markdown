# Scratchpad Workbench — End-to-End Product & Implementation Spec (v1.0)

**Status:** Build-ready handoff  
**Intended executor:** Codex or equivalent implementation agent  
**Document type:** Product spec + technical spec + acceptance plan  
**Primary goal:** Build, test, and validate a local-first desktop app for markdown/YAML editing, quick preview, transient capture, and reusable prompt management.

---

# 1. Executive Summary

Scratchpad Workbench is a **desktop, local-first, markdown-native workflow buffer** for AI-assisted work.

It is **not** just a markdown editor and **not** a full prompt operations platform.

It is a focused workbench for these jobs:

- open, preview, and edit markdown and YAML files quickly
- drag and drop files into the app for immediate viewing/editing
- paste or drop text, code snippets, and images into a persistent shelf
- save and reuse prompts as first-class assets
- stage work-in-progress while switching between IDEs, browsers, LLM chats, and design tools
- recover active work after restart without losing context

The product should feel like a **premium developer utility**:
- fast
- stable
- calm
- low-friction
- local-first
- keyboard-friendly

---

# 2. Product Framing

## Product sentence

**Scratchpad is a markdown-native workflow workbench for capturing, refining, organizing, and reusing documents, snippets, images, and prompts across active AI workflows.**

## What problem it solves

When working across multiple apps and AI tools, users constantly need to:
- hold temporary text/code/images
- iterate on prompts
- preview markdown quickly
- open files without friction
- queue the next action while waiting on another tool
- avoid losing copied content or half-finished thoughts

Current tools split these jobs poorly:
- markdown editors are document-first, not workflow-first
- clipboard managers are too shallow for structured work
- notes apps are too heavy
- prompt tools are often overbuilt and not integrated with general work capture

Scratchpad fills that gap.

---

# 3. Product Scope

## In scope for v1

### Core capabilities
1. **Markdown/YAML open, preview, and edit**
2. **Drag-and-drop open**
3. **Clipboard-style capture shelf**
4. **Prompt library**
5. **Autosave and session restore**
6. **Multi-tab workspace with usable overflow behavior**
7. **Local asset persistence**
8. **Search and filtering across saved assets**
9. **Keyboard shortcuts for frequent actions**

## Out of scope for v1
Do **not** implement these unless already trivial:
- cloud sync
- collaboration or multi-user features
- OCR
- AI generation or LLM API integration
- prompt benchmarking across models
- semantic search
- plugin ecosystem
- rich WYSIWYG editing
- embedded browser
- workspace sharing
- mobile app
- marketplace features
- heavy database admin UI
- complex PKM features

---

# 4. Primary Users

## Primary user
A solo builder / developer / AI power user who works across:
- IDE
- browser
- chat tools
- design tools
- terminal
- docs/specs

## Characteristics
- copies/pastes between tools frequently
- iterates on prompts repeatedly
- needs fast markdown preview/editing
- wants transient work captured safely
- values speed and reliability over feature bloat

---

# 5. Jobs To Be Done

## JTBD 1 — Quick file view
When I click or drop a markdown file into the app, I want it to open instantly in a readable preview/editor so I can inspect it without friction.

## JTBD 2 — Safe temporary holding
When I copy text, code, or images during active work, I want to stash them quickly without losing them so I can reuse them later.

## JTBD 3 — Prompt reuse
When I create prompts I use repeatedly, I want to save, categorize, refine, and quickly copy them so I can work faster.

## JTBD 4 — Session continuity
When I restart the app or computer, I want my tabs, shelf items, and unsaved drafts restored so I can resume work immediately.

## JTBD 5 — Multi-app thinking
When I am waiting on another tool, I want to queue up the next snippets, notes, prompts, or edits in one place.

---

# 6. Product Principles

1. **Local-first**
   - user data stays local by default
   - no account required
   - no cloud dependency

2. **Fast over fancy**
   - file open and paste actions must feel immediate
   - avoid multi-step capture flows

3. **Markdown-native**
   - markdown and YAML are first-class
   - preserve plain text integrity
   - avoid magical transformations that damage source files

4. **Assets, not clutter**
   - docs, prompts, snippets, and images are first-class asset types
   - keep metadata lightweight

5. **Transient + durable**
   - support both quick capture and durable saved reuse

6. **Low-cognitive-load UI**
   - calm visual hierarchy
   - no overloaded chrome
   - strong defaults

7. **Recoverability**
   - autosave
   - session restore
   - clear dirty state
   - graceful handling of app interruptions

---

# 7. Platform and Technical Recommendation

## Recommended implementation target
**Desktop application**

## Recommended stack
Use this stack unless the existing repo already mandates something else:

- **Tauri 2**
- **React**
- **TypeScript**
- **Vite**
- **Zustand** for client state
- **TanStack Query** only if useful for internal async state; otherwise do not force it
- **Monaco Editor** or CodeMirror 6 for source editing
- **react-markdown** for preview rendering
- **gray-matter** for YAML/frontmatter parsing
- **better-sqlite3** or Tauri SQLite plugin for metadata persistence
- local filesystem storage for raw asset content
- **Vitest** for unit tests
- **Playwright** for end-to-end testing
- **Zod** for runtime schema validation where useful

## Why this stack
- Tauri keeps the app lightweight
- React/TypeScript reduce ambiguity for implementation agent
- Monaco/CodeMirror provide stable editing
- SQLite + filesystem handles local-first structured assets well
- Playwright provides realistic validation

## Alternate stack fallback
If repository constraints strongly favor Electron, implementation may use Electron, but only if:
- the final feature set and UX remain the same
- local file and clipboard handling remain robust
- tests still cover required flows

---

# 8. Information Architecture

## Top-level app sections
- Workspace
- Library
- Shelf
- Sessions
- Settings

## Library subsections
- Prompts
- Docs
- Snippets
- Images
- Templates

## Asset types
- `document`
- `prompt`
- `snippet`
- `image`
- `template`
- `session`

## Saved vs transient distinction
The product must support:
- **transient assets**: quick-captured items not yet organized
- **saved assets**: named, categorized, searchable items

---

# 9. Core Screens

## Screen 1 — Workspace
Primary editing and viewing screen.

### Purpose
- open files
- edit markdown/YAML
- preview content
- manage multiple tabs
- move items to shelf/library

### Regions
- left nav rail
- top toolbar
- tab bar
- main editor/preview area
- optional right details panel
- optional bottom or side shelf drawer

### Required controls
- open file
- new document
- toggle view mode: Edit / Split / Preview
- save
- save as
- add selected content to shelf
- search within document
- tab close / pin
- unsaved change indicator

---

## Screen 2 — Prompt Library
List/detail/editor experience for reusable prompts.

### Purpose
- browse prompts
- search prompts
- edit prompts in markdown
- copy/duplicate prompts quickly
- save prompt templates

### Regions
- filters/categories list
- prompt list
- prompt editor
- metadata panel

### Required controls
- create prompt
- duplicate
- favorite
- copy
- add to shelf
- save as template
- version view (basic)
- tags/categories/target tool fields

---

## Screen 3 — Shelf
Persistent clipboard-style holding area.

### Purpose
- hold text snippets
- hold code snippets
- hold images
- hold temporary prompt drafts
- hold multiple items simultaneously

### Required capabilities
- paste from clipboard
- drag and drop into shelf
- reorder items
- convert item to saved asset
- copy item back out
- delete item
- pin item
- search/filter shelf

---

## Screen 4 — Session Restore / History
Resume prior work safely.

### Purpose
- reopen last session
- inspect recent sessions
- restore tabs and unsaved drafts
- recover crash/interrupted state

### Required controls
- restore last session
- open past session
- discard session
- start clean session

---

## Screen 5 — Settings
Minimal settings only.

### Required settings
- theme mode or theme selection if implemented
- autosave interval
- default startup behavior
- default file open mode
- asset storage location
- image paste behavior
- confirm before deleting saved assets
- keyboard shortcuts reference

---

# 10. UX Requirements

## 10.1 General UI requirements
- dark mode first
- calm developer-tool aesthetic
- strong typography hierarchy
- subtle borders/dividers
- no cramped header
- no tab overlap
- no hidden essential actions
- keyboard and mouse both supported

## 10.2 Navigation
- left rail remains stable
- top toolbar must not collapse into unusable overlap
- responsive within desktop window resizing
- if width becomes constrained, lower-priority actions move into overflow menu

## 10.3 Tab system
The current known UX issue is broken/overlapping tabs. Fix this explicitly.

### Required tab behavior
- each open asset/file appears as a tab
- tabs can be reordered
- tabs can be pinned
- tabs can be closed individually
- active tab is clearly highlighted
- dirty/unsaved tabs show indicator
- when tabs exceed available width:
  - tabs do not overlap
  - tabs shrink to a min width
  - overflow tabs move into a dropdown or horizontal scroll region
- tab close buttons remain usable
- middle-click close optional but not required

## 10.4 View modes
For markdown and prompt editing, support:
- Edit
- Split
- Preview

### Behavior
- Edit = source only
- Split = source and preview side-by-side
- Preview = rendered output only

Remember last-used mode per asset type or per tab if practical.

## 10.5 Clipboard and capture behavior
Capture must be fast.

### Supported capture flows
- paste plain text -> creates shelf item
- paste code block -> creates snippet shelf item
- paste image -> creates image shelf item
- drag text file into app -> open or import depending on drop target
- drag image into shelf -> save as shelf image item
- drag snippet into shelf -> create snippet item

Where detection is ambiguous, default to safe handling and let user convert type later.

## 10.6 Autosave UX
- autosave unsaved work locally
- clearly mark saved vs unsaved state
- do not spam user with modal confirmations
- restore drafts after restart

## 10.7 Search UX
Need at least:
- global library search
- prompt search
- shelf search
- in-document search

---

# 11. Functional Requirements

## FR-1 File opening
The app shall allow users to:
- open `.md`, `.markdown`, `.txt`, `.yml`, `.yaml`
- drag and drop supported files onto the app
- open files from OS integration if feasible
- handle unsupported files gracefully with a clear message

## FR-2 Markdown rendering
The app shall render markdown preview with:
- headings
- paragraphs
- lists
- code blocks
- inline code
- blockquotes
- links
- tables
- images referenced in markdown where path resolution is safe and feasible

## FR-3 YAML/frontmatter handling
The app shall:
- preserve YAML/frontmatter
- parse frontmatter for display/metadata when useful
- never silently strip or corrupt YAML
- allow direct editing of YAML source

## FR-4 Tabbed multi-document workspace
The app shall support multiple open tabs with:
- stable non-overlapping layout
- dirty state
- reorder
- close
- restore on relaunch

## FR-5 Shelf capture
The app shall support shelf items of types:
- text
- code snippet
- image
- prompt draft

Each shelf item shall support:
- title or generated label
- timestamp
- copy
- pin
- delete
- convert to saved asset
- edit if text-based

## FR-6 Prompt library
The app shall support prompt assets with:
- title
- body (markdown/plain text)
- category
- tags
- favorite state
- optional target tools
- updated timestamp
- last used timestamp
- duplicate action
- copy action
- basic version metadata

## FR-7 Asset persistence
The app shall persist all saved assets locally and recover them after restart.

## FR-8 Session persistence
The app shall restore:
- open tabs
- unsaved drafts
- shelf items
- previous window layout state where feasible

## FR-9 Search and filter
The app shall support:
- search by title/content/tags for prompts and text assets
- filter by type
- filter by category
- filter favorites
- filter recent

## FR-10 Save/export actions
The app shall support:
- save document
- save as new document
- save prompt
- save shelf item as prompt/snippet/doc
- export image asset to file
- copy asset content to clipboard

## FR-11 Deletion and recovery
The app shall support:
- deleting assets
- confirmation for deleting saved assets
- soft delete optional; if not implemented, deletion warning required

## FR-12 Keyboard shortcuts
At minimum:
- new document
- open file
- save
- find
- toggle view mode
- new prompt
- focus search
- copy selected asset
- add to shelf
- open command palette optional

## FR-13 Error handling
The app shall:
- fail safely on malformed files
- display non-blocking error feedback where possible
- never lose saved content due to minor parsing/render errors

---

# 12. Non-Functional Requirements

## NFR-1 Performance
- app cold start should feel fast on modern desktop hardware
- opening a normal markdown file should feel near-instant
- paste-to-shelf action should complete without noticeable lag for common content sizes
- UI must remain responsive when several tabs are open

## NFR-2 Reliability
- autosave should protect against routine interruption
- session restore should be reliable after normal restart and common crash scenarios

## NFR-3 Local-first security
- no network dependency for core features
- no background upload behavior
- local storage paths should be explicit and controlled

## NFR-4 Maintainability
- use clear separation between domain logic, persistence, and UI
- avoid over-abstracted architecture
- prefer readable code over clever frameworks

## NFR-5 Accessibility
- keyboard reachable
- visible focus states
- adequate contrast in dark mode
- no critical action hidden behind hover-only UI

---

# 13. Data Model

## 13.1 Conceptual model

### Asset
Common base concept for everything persisted.

Common fields:
- `id`
- `type`
- `title`
- `created_at`
- `updated_at`
- `favorite`
- `pinned`
- `tags`
- `source_kind` (`imported`, `created`, `captured`, `generated_label`)
- `status` (`transient`, `saved`, `archived`)

### DocumentAsset
Fields:
- `file_path` (nullable)
- `body`
- `frontmatter_raw` (nullable)
- `view_mode`
- `encoding`
- `is_external_file`

### PromptAsset
Fields:
- `body`
- `category`
- `target_tools` (array)
- `version`
- `last_used_at`
- `notes`
- `variables` (array of placeholders if extracted)

### SnippetAsset
Fields:
- `body`
- `language` (nullable)
- `origin_note` (nullable)

### ImageAsset
Fields:
- `file_name`
- `storage_path`
- `mime_type`
- `width`
- `height`
- `origin_note` (nullable)

### Session
Fields:
- `id`
- `name`
- `created_at`
- `updated_at`
- `open_tab_ids`
- `active_tab_id`
- `window_state`
- `restorable`
- `crash_recovered`

## 13.2 Suggested schema example

```yaml
Asset:
  id: string
  type: document | prompt | snippet | image | template
  title: string
  favorite: boolean
  pinned: boolean
  tags: string[]
  status: transient | saved | archived
  created_at: datetime
  updated_at: datetime

PromptAsset:
  id: prm_001
  type: prompt
  title: Google Stitch Prompt - Prompt Library Screen
  category: Design
  tags: [stitch, ui, prompts]
  favorite: true
  pinned: false
  status: saved
  body: |
    Design a dark-mode desktop prompt library screen...
  target_tools: [Stitch, ChatGPT, Claude]
  version: 3
  last_used_at: 2026-03-21T08:30:00Z
  notes: For first-pass concept generation
```

## 13.3 Persistence recommendation
Use:
- SQLite for structured metadata
- filesystem for raw bodies and image blobs if needed
- alternatively, keep text assets in SQLite if simpler and reliable
- choose the simplest design that is robust

### Recommended practical approach
- SQLite stores metadata and text asset body
- images stored on disk in app data directory
- image table stores path and metadata
- sessions stored in SQLite

This is easier than splitting every text file into individual blobs.

---

# 14. File and Persistence Behavior

## Storage locations
Use OS-appropriate application data directories.

Suggested structure:
- `/app-data/db.sqlite`
- `/app-data/images/...`
- `/app-data/sessions/...` if needed
- `/app-data/backups/...` optional

## External file editing behavior
If user opens a real file from disk:
- edits should modify that file on save
- autosave for unsaved changes may use local draft buffer before explicit save
- warn user if file changed externally while open if feasible

## Imported/captured assets
For transient or saved internal assets:
- persist inside app data
- do not require original external source path

---

# 15. Prompt Feature Spec

## Purpose
Prompt management is a capability inside the workbench, not the entire product.

## Required prompt fields
- title
- body
- category
- tags
- favorite
- target tools
- version integer
- notes
- updated timestamp
- last used timestamp

## Required prompt actions
- create
- edit
- preview
- copy
- duplicate
- favorite/unfavorite
- add to shelf
- save as template
- basic version increment on duplicate/save optional but recommended

## Prompt categories seed values
- Design
- CI/CD
- Architecture
- Coding
- Research
- Writing
- Red Team
- Agent Instructions

Support custom categories.

## Prompt-specific UX requirement
A prompt must feel like a reusable working asset, not like a form record.

The primary interaction is:
- browse
- open
- edit
- copy
- reuse

Not:
- fill out a giant metadata form

---

# 16. Shelf Feature Spec

## Purpose
The shelf is a persistent transient holding area.

## Required shelf item types
- text
- code snippet
- image
- prompt draft

## Required shelf actions
- paste from clipboard into shelf
- drag item into shelf
- reorder
- pin
- copy back to clipboard
- edit text items
- delete
- convert to saved prompt/snippet/doc
- rename/title item

## Shelf UX requirements
- visible enough to be useful
- collapsible when not needed
- should not block the main editor unnecessarily
- must support multiple items
- item previews should be scannable

---

# 17. Markdown and YAML Editing Spec

## Editor requirements
- syntax highlighting for markdown and yaml
- line numbers optional
- word wrap toggle optional
- predictable selection/copy behavior
- stable large-text editing

## Preview requirements
- clean markdown rendering
- syntax-highlighted code blocks if reasonably easy
- rendered tables and images
- scroll behavior should be stable
- synchronized scrolling between editor and preview is optional, not required for v1

## YAML requirements
- preserve original formatting where possible
- do not auto-normalize aggressively
- show parse errors non-destructively
- allow editing even if YAML is malformed

---

# 18. Command and Shortcut Spec

## Required shortcuts
- `Cmd/Ctrl+N` — new document
- `Cmd/Ctrl+O` — open file
- `Cmd/Ctrl+S` — save
- `Cmd/Ctrl+Shift+S` — save as
- `Cmd/Ctrl+F` — find in current asset
- `Cmd/Ctrl+P` — quick open or command palette (choose one)
- `Cmd/Ctrl+Shift+P` — command palette if implemented separately
- `Cmd/Ctrl+L` — focus global search
- `Cmd/Ctrl+\` — toggle split/edit/preview mode if practical
- `Cmd/Ctrl+W` — close tab
- `Cmd/Ctrl+Shift+T` — reopen closed tab optional
- `Cmd/Ctrl+Alt+S` — add current selection to shelf optional

Implementation may adjust exact mappings for platform norms, but must preserve usability.

---

# 19. Empty States and First-Run UX

## First-run experience
On first launch, show a useful empty state:
- open a markdown file
- create a new note
- open prompt library
- paste into shelf

## Empty prompt library state
Show:
- create first prompt
- import examples optional
- categories preview

## Empty shelf state
Show concise hint:
- paste text, code, or images here
- drag and drop items here
- shelf items persist until deleted

---

# 20. UX Copy Guidance

Tone should be:
- concise
- direct
- operational
- not playful
- not overly technical in user-facing copy

Examples:
- “Paste to Shelf”
- “Add to Library”
- “Restore Last Session”
- “Unsaved changes”
- “Unsupported file type”
- “Saved locally”

---

# 21. Implementation Plan

## Phase 1 — Foundation
Build:
- app shell
- left nav
- top toolbar
- tab system
- workspace editor/preview
- file open/save
- drag-and-drop file open
- local persistence foundation

### Exit criteria
- app launches reliably
- markdown files can be opened and edited
- tabs work without overlap
- save/open flows work

## Phase 2 — Shelf
Build:
- shelf UI
- paste handling
- item model
- item persistence
- image capture
- code/text item editing

### Exit criteria
- pasted text/code/images persist in shelf
- shelf items can be copied and deleted
- restart restores shelf state

## Phase 3 — Prompt Library
Build:
- prompt asset model
- prompt list/detail/editor
- categories/tags
- copy/duplicate/favorite
- add-to-shelf integration
- search/filter

### Exit criteria
- prompts are fully usable as first-class assets
- prompt reuse flow is fast and stable

## Phase 4 — Sessions, search, polish
Build:
- session restore
- recent sessions
- global search
- settings
- error handling improvements
- keyboard shortcut help
- UX polish

### Exit criteria
- crash/restart recovery works
- global search works
- no major blocking UX defects remain

## Phase 5 — Testing and validation
Build and run:
- unit tests
- integration tests
- end-to-end tests
- manual smoke checklist
- fix defects until all pass

---

# 22. Testing Strategy

## 22.1 Unit tests
Test at minimum:
- asset model validation
- prompt metadata parsing
- frontmatter parsing
- view mode state logic
- session serialization/deserialization
- search/filter logic

## 22.2 Component/integration tests
Test:
- tab overflow behavior
- prompt save/edit/copy
- shelf paste flows
- markdown preview rendering
- dirty state indicators
- session restore logic

## 22.3 End-to-end tests
Use Playwright or equivalent to validate full flows.

### Required E2E cases

#### E2E-1 Open markdown file
- launch app
- open markdown file
- verify content renders in editor
- switch to preview
- save edit
- verify file updated

#### E2E-2 Drag and drop file
- drag markdown file into app
- verify new tab opens
- verify preview works

#### E2E-3 Paste text into shelf
- copy plain text
- paste into shelf
- verify item created
- restart app
- verify item persists

#### E2E-4 Paste image into shelf
- place image on clipboard if feasible in test environment
- paste into shelf
- verify image item appears
- verify persistence after restart

#### E2E-5 Create and reuse prompt
- create prompt
- add title/category/tags/body
- save
- copy prompt
- duplicate prompt
- verify both entries exist

#### E2E-6 Restore session
- open multiple tabs
- create unsaved draft
- restart app
- verify session restoration

#### E2E-7 Search library
- create multiple assets
- search by title/tag/category
- verify correct filtered results

#### E2E-8 Tab overflow
- open many tabs
- verify tabs remain usable and no overlap occurs

## 22.4 Manual smoke tests
Before declaring done, run manual checks for:
- resizing window
- narrow width behavior
- unsaved changes indicators
- deleting assets
- malformed YAML
- malformed markdown
- non-supported file drop
- image-heavy shelf use
- keyboard shortcuts

---

# 23. Acceptance Criteria

## Product acceptance
The build is acceptable only if all of the following are true:

### Core workflow acceptance
- user can open, edit, preview, and save markdown/YAML files
- drag-and-drop open works
- shelf can hold text, code, and image items
- prompts can be created, saved, edited, copied, and duplicated
- sessions restore reliably
- tabs do not overlap or become unusable
- local persistence survives restart

### UX acceptance
- top chrome is usable at normal desktop widths
- no critical path requires excessive clicks
- prompt workflow feels fast
- shelf is clearly useful and not bolted on
- the app feels coherent as one product

### Stability acceptance
- no known critical defects
- all automated tests pass
- smoke tests pass
- no data loss observed in normal usage scenarios

---

# 24. Definition of Done for Codex

Codex should consider the task complete only when:

1. the app is fully implemented against this spec or documented deviations are explicitly listed
2. dependencies install cleanly
3. the project builds successfully
4. automated tests are present and passing
5. end-to-end validation covers critical workflows
6. manual smoke checks have been run
7. any remaining issues are documented as non-blocking
8. a concise implementation summary is produced
9. run instructions are included
10. the app has been exercised enough to reasonably claim the core flows work

Codex must **not** stop at “code written.”
It must stop at **working, tested, and validated**.

---

# 25. Required Final Deliverables from Codex

Codex should produce:

## Deliverable A — Working application
A runnable desktop app project.

## Deliverable B — README
Include:
- setup
- install
- run
- build
- test
- storage behavior
- known limitations

## Deliverable C — Test summary
Include:
- unit tests added
- e2e tests added
- pass/fail status
- any skipped tests and why

## Deliverable D — Deviation log
If anything in this spec was changed, omitted, or simplified, list:
- what changed
- why
- impact

## Deliverable E — Manual validation summary
Brief checklist confirming:
- core file open/edit/save
- prompt flows
- shelf flows
- session restore
- tab overflow behavior

---

# 26. Codex Execution Instructions

Use the following instructions as operational guidance for the implementation agent.

## Instruction block
Build this application end-to-end as a local-first desktop app.

Requirements:
- implement the product described in this spec
- use the recommended stack unless repository constraints clearly require a substitute
- keep architecture straightforward and maintainable
- prioritize stable UX and core workflows over optional enhancements
- test all critical paths
- do not claim completion until the app is working, tests pass, and validation is done
- document any deviations clearly
- do not overbuild beyond v1 scope

## Priorities
1. correctness
2. usability
3. data safety
4. maintainability
5. visual polish

## Explicit anti-goals
- do not add cloud accounts or sync
- do not add unnecessary AI API features
- do not add speculative enterprise architecture
- do not add unnecessary abstractions
- do not convert this into a bloated note-taking app

---

# 27. Suggested Task Breakdown for Codex

1. initialize desktop app shell and stack
2. implement routing/layout/app chrome
3. implement local persistence layer
4. implement asset domain models
5. implement workspace + editor + preview
6. implement file open/save + drag/drop
7. implement tab system and overflow handling
8. implement shelf capture and persistence
9. implement prompt library and editor
10. implement session restore
11. implement search/filter/settings
12. add automated tests
13. run e2e validation
14. fix defects
15. produce final documentation and summary

---

# 28. Design Direction

## Visual direction
- premium dark desktop utility
- calm slate/charcoal surfaces
- subtle accent color
- modern but restrained
- not playful
- not cluttered
- not overly glassy
- not neon

## Interaction direction
- minimal friction
- fast access to primary actions
- clear selected states
- clear saved/unsaved states
- gentle visual hierarchy

---

# 29. Known Product Risks

## Risk 1 — Bloat
Trying to make this a notes app, prompt ops system, and clipboard manager all at once will degrade UX.

### Response
Keep the v1 scope tight.

## Risk 2 — Fragile file editing
Directly editing external files can introduce edge cases.

### Response
Use clear save semantics and autosave drafts carefully.

## Risk 3 — Tab UX regression
Tab systems often degrade quickly as features accumulate.

### Response
Explicitly test overflow and resize behavior.

## Risk 4 — Image persistence complexity
Clipboard and image storage can get messy.

### Response
Keep image model simple and local-first.

---

# 30. Nice-to-Have Features If They Fall Out Naturally
Only after all required work is complete and stable:
- command palette
- recent files panel
- quick-open
- basic templates
- split orientation toggle
- drag shelf item into editor
- simple markdown export helpers

Do not let these delay v1 completion.

---

# 31. Final Implementation Decision

This product should be built as:

**A local-first desktop markdown workbench with:**
- robust file open/edit/preview
- a persistent capture shelf
- a reusable prompt library
- reliable session restore
- clean, non-broken multi-tab UX

That is the product.

Anything that does not support that directly is secondary.

---

# 32. Handoff Note

This spec is designed to be handed directly to an implementation agent.

If any part is ambiguous, default to:
- simpler architecture
- safer persistence behavior
- clearer UX
- tighter scope

Do not optimize for novelty.
Optimize for a solid tool that gets used daily.
