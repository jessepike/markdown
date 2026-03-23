# AGENTS.md

This file provides operational guidance for agents working in this repository.

## Product Identity And Scope

- The shipped v1 product name in this repository is `AgentPad`.
- Treat `Scratchpad` in planning/spec docs as the same v1 product unless a document explicitly says otherwise.
- Use `AgentPad` consistently in code, copy, docs, and UI for the current build.
- AgentPad v1 is a local-first, markdown-native desktop workbench.
- Treat `docs/scratchpad-workbench-end-to-end-spec-v1.0.md` as the build authority.
- Use `docs/scratchpad-final-design-selection-brief-v1.0.md` as the visual and product-boundary authority when the spec leaves room for interpretation.

AgentPad v1 includes:
- Main Workspace
- Library mode
- Prompt Library behavior
- Shelf mode
- Sessions
- Search
- Settings
- source / split / preview
- stable tabs
- local persistence
- autosave
- session restore

AgentPad v1 does not include:
- Comparison Engine
- Deploy workflows
- Evaluations
- Datasets
- prompt ops platform behavior

## Product Shape

- Build a workbench, not a platform.
- Keep the product document-first, with Shelf and Prompt Library as supporting first-class capabilities.
- Optimize for active daily use, not broad product sprawl.
- When there is ambiguity, default to the smaller, tighter, flatter, more operational solution that keeps the product within v1 workbench scope.

## Implementation Priorities

1. correctness
2. usability
3. data safety
4. maintainability
5. visual polish

- Preserve the current repo stack when sensible.
- Avoid unnecessary rewrites.
- Prefer incremental improvement over speculative architecture.
- Keep persistence simple and reliable.
- Do not widen scope.
- Finish end-to-end: assess, plan, implement, test, validate critical flows, and only then report ready for review.

## Current Stack And Architecture

- Desktop app: Tauri v2
- Frontend: Vite + JavaScript
- Editor: CodeMirror 6
- Preview: `markdown-it` rendered in `src/render.worker.js`, sanitized with DOMPurify
- Frontmatter: custom parsing/rendering in `src/render.worker.js`
- Backend: Rust in `src-tauri/src/lib.rs`

Current core patterns to preserve unless there is a strong repo-specific reason to change them:
- Three view modes: `editor`, `split`, `preview`
- Worker-based markdown rendering to keep the UI responsive
- Local settings persistence for UI state
- Native file open/save behavior through Tauri
- Launch/file-association handling through the Tauri backend

## Product And Navigation Authority

- Main Workspace is the default home shell.
- Prompt Library is a mode inside the same system.
- Shelf is a dedicated capture/staging mode.
- The active document/editor remains the primary visual focus.
- Shelf stays visually secondary and compact by default.

Primary nav for v1:
- Workspace
- Library
- Shelf
- Sessions
- Search
- Settings

Execution expectations:
- Inspect the repository before writing code.
- Map implementation work to the spec and approved v1 scope.
- Prefer incremental completion over broad refactors.
- Run configured tests and add coverage for critical logic and flows when missing.
- Manually validate the required primary workflows before declaring the work complete.

## Design Authority

- The visual and interaction authority for v1 is the `Monolithic Workbench` direction.
- Approved screen visuals in `docs/design/v1-approved/` are the visual authority for shipped v1 screens.
- HTML in `docs/design/stitch-exports/` is structural prototype reference only.
- Do not copy Stitch HTML into production unchanged.
- Port the useful patterns from Stitch exports into the real app architecture and component system.
- Any design artifact under a `p2` folder is backlog reference only, not v1 scope.

UI direction for v1:
- dark graphite / charcoal tonal layering
- no pure black
- no glassmorphism
- no gradients
- sparse accent color
- compact utility shelf cards
- integrated top chrome
- low-noise desktop-tool feel

Avoid:
- dashboard energy
- decorative analytics
- consumer productivity styling
- platform/admin-console styling unless explicitly required

## UI Implementation Rules

- Tabs must not overlap or become unusable.
- Top bar should remain deterministic and uncluttered.
- Document/editor remains dominant.
- Shelf cards use compact density by default.
- Rich cards are mainly for images.
- Metadata panels should be lightweight.
- Prompt screens should feel like reusable working assets, not admin records.

## P2 Backlog Containment

Explicitly defer these to later phases:
- prompt version history
- prompt comparison view
- variable/schema validation
- release/deploy workflow
- evaluations
- datasets / structured inputs

## Development Commands

### Running the application
```bash
npm run dev
npm run tauri dev
```

### Building
```bash
npm run build
npm run tauri build
```

### Frontend only
```bash
npm run preview
```

## Existing Repo Behavior

- View modes are `editor`, `split`, and `preview`. Preserve these and extend them to support the approved AgentPad workspace model.
- Keep markdown and YAML handling source-safe. Do not destroy or rewrite content because frontmatter is malformed.
- Preserve file-open behavior from OS launch and drag/drop flows while expanding the app toward the approved v1 surface area.
- Keep local state and persistence behavior predictable and recoverable.
