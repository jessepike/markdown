# Codex Execution Prompt — Scratchpad Workbench Build (v1.0)

Use this prompt with Codex as the implementation instruction set for the Scratchpad Workbench project.

---

## Primary instruction

You are implementing **Scratchpad Workbench**, a local-first desktop app for markdown/YAML editing, quick preview, persistent transient capture, and reusable prompt management.

You must use the attached spec file as the **build authority**:

- `scratchpad-workbench-end-to-end-spec-v1.0.md`

Do not treat the spec as inspiration. Treat it as the source of truth unless a repository constraint makes a requirement impossible or clearly inadvisable. If that happens, document the deviation explicitly.

Your job is to:
1. inspect the repository
2. determine the current architecture and implementation status
3. plan the work against the spec
4. implement missing features end-to-end
5. run and fix tests
6. validate critical user flows
7. report only when the product is working against the acceptance criteria

Do **not** stop at “I wrote code.”
Stop only at **working, tested, validated**.

---

## Operating mode

Work like a senior implementation engineer with product discipline.

Priorities:
1. correctness
2. usability
3. data safety
4. maintainability
5. visual polish

Do not overbuild.
Do not widen scope beyond the v1 spec.
Do not invent product features outside the documented scope unless they are strictly necessary to make the required flows work.

---

## Repository-first behavior

Before writing code:

1. inspect the repository structure
2. identify the current stack
3. identify what already exists
4. identify what is broken, missing, or partial relative to the spec
5. produce a brief implementation plan mapped to the spec sections
6. then execute

### You must explicitly determine:
- app platform and framework already in use
- package manager
- build system
- editor/rendering libraries already present
- persistence/storage approach already present
- current screens/components already present
- current test setup already present
- whether the repo is closer to Tauri or Electron or something else
- what can be preserved vs replaced

If the repo already uses a sensible stack, prefer **incremental completion** over unnecessary rewrites.

If the repo is too incomplete or structurally unsound to support the required product cleanly, you may refactor, but keep refactors proportional and explain them.

---

## Required workflow

### Phase 0 — Assess
Read the spec and inspect the repo.

Produce a concise working note for yourself covering:
- current status
- missing capabilities
- key blockers
- implementation order

### Phase 1 — Align architecture
Choose the implementation approach that best fits the repo while still satisfying the spec.

Default preference:
- preserve existing app shell where viable
- preserve existing styling direction if compatible
- fix broken UX instead of repainting everything unnecessarily

### Phase 2 — Implement core product
Implement the required v1 capabilities from the spec:
- markdown/yaml open, edit, preview
- drag and drop file open
- stable multi-tab workspace
- persistent shelf for text/code/image capture
- prompt library
- local persistence
- autosave and session restore
- search/filter
- keyboard shortcuts
- settings needed for core flows

### Phase 3 — Test and validate
You must:
- run linting if configured
- run unit tests if configured
- add missing tests for critical logic
- add end-to-end tests for critical user flows
- fix failures
- manually validate critical workflows

### Phase 4 — Final report
Only after implementation and validation, produce:
- summary of what was built
- files/components/services added or changed
- tests added and results
- manual validation results
- known limitations
- explicit deviation log, if any

---

## Acceptance bar

You are **not done** until all of the following are true:

- the app builds successfully
- critical required flows from the spec work
- automated tests for core logic exist and pass
- end-to-end coverage exists for primary workflows
- no known critical defects remain
- session persistence and shelf persistence work
- prompt library flows work
- tabs do not overlap or become unusable
- markdown/yaml open/edit/preview/save flows work
- you have documented any deviations

If something cannot be completed, do not hide it.
State it clearly and explain:
- what is incomplete
- why
- what blocks it
- impact on the spec

---

## Explicit implementation instructions

### 1. Use the spec as the requirements baseline
Map implementation back to the spec.
For each major feature, verify:
- requirement exists in spec
- implementation satisfies it
- test or validation exists

### 2. Prefer the existing repo stack unless there is a strong reason not to
If the repo already uses:
- Tauri, stay on Tauri if reasonable
- Electron, stay on Electron if reasonable
- React/TypeScript, keep it
- an editor library already integrated, evaluate whether it is good enough before replacing

Do not rewrite just because you prefer a different stack.

### 3. Fix UX structure, not just styling
The product problem is not cosmetic only.

You must ensure:
- top bar is usable
- tabs are usable under overflow
- workspace layout is coherent
- shelf is integrated, not bolted on
- prompt editing and browsing are both supported cleanly

### 4. Keep persistence simple and reliable
Prefer the simplest local-first persistence model that robustly supports:
- documents
- prompts
- snippets
- images
- sessions

If the repo already has a persistence layer, extend it if sane.
If not, implement one cleanly.

### 5. Preserve user content safely
Be conservative with:
- external file editing
- autosave semantics
- deletion behavior
- malformed YAML handling

### 6. Avoid speculative features
Do not add:
- cloud sync
- login/account systems
- LLM integrations
- prompt benchmarking
- plugin framework
- collaboration
- OCR
- enterprise abstractions

Unless absolutely required for an existing repo dependency pattern, do not introduce them.

---

## Required validation checklist

You must validate these flows before declaring success.

### Flow 1 — Open markdown file
- open existing markdown file
- verify content appears in editor
- switch to preview
- edit and save
- verify saved result

### Flow 2 — Open YAML/markdown with frontmatter
- open document containing YAML frontmatter
- verify source preserved
- verify editing works
- verify malformed YAML does not destroy content

### Flow 3 — Drag/drop file open
- drag markdown file onto app
- verify it opens in a new tab

### Flow 4 — Tab overflow
- open enough tabs to exceed available width
- verify tabs remain usable
- verify no overlapping click targets

### Flow 5 — Shelf text capture
- paste text into shelf
- verify item persists after restart

### Flow 6 — Shelf code capture
- paste code into shelf
- verify snippet item works and can be copied back out

### Flow 7 — Shelf image capture
- paste or drop image into shelf
- verify image persists after restart

### Flow 8 — Prompt library create/edit/reuse
- create prompt
- categorize/tag it
- save it
- edit it
- duplicate it
- copy it
- add it to shelf

### Flow 9 — Session restore
- leave multiple tabs and unsaved content open
- restart app
- verify restoration

### Flow 10 — Search/filter
- create multiple prompts/assets
- verify search and filters return expected results

---

## Reporting format

When giving progress or final output, be concrete.

### Progress update format
Use this structure:
- what you inspected
- what you found
- what you changed
- what remains
- any blockers or deviations

### Final report format
Use this structure:

#### 1. Build summary
Brief description of what is now implemented.

#### 2. Major changes
Grouped by:
- workspace/editor
- tab system
- shelf
- prompt library
- persistence
- sessions
- search/settings
- tests

#### 3. Validation results
List:
- automated tests run
- pass/fail
- manual flows checked
- any failures fixed

#### 4. Deviations from spec
For each deviation:
- spec item
- implemented alternative
- reason
- impact

#### 5. Known limitations
Only non-blocking items.

#### 6. Run instructions
Exact commands to install, run, test, and build.

---

## Deviation policy

If you deviate from the spec, you must log it.

Valid reasons:
- repo architecture conflict
- platform limitation
- dependency incompatibility
- safer simpler implementation with equivalent user outcome

Invalid reasons:
- personal preference
- premature optimization
- adding unrelated features
- avoiding a hard but required part of the build

---

## Practical repo inspection checklist

Inspect at minimum:
- root package files
- app shell / main entry points
- current routes/screens
- current state stores
- current persistence layer
- file open/save handling
- editor component
- preview renderer
- tests folder/config
- build scripts
- Tauri/Electron config if present

Look specifically for:
- broken tab implementation
- current markdown/yaml support
- current drag/drop handling
- current clipboard handling
- current prompt-like features if any
- any session persistence already present

---

## Implementation heuristics

When multiple implementation options exist:
- choose the one that reduces future complexity
- prefer explicit state over magical hidden behavior
- prefer predictable UX over cleverness
- prefer fewer concepts over many concepts

Examples:
- simple tab overflow menu is better than brittle custom compression
- simple shelf item cards are better than overengineered boards
- simple prompt metadata is better than heavy schemas
- reliable restore is better than fancy animations

---

## Target product shape

The final product should feel like:

- a premium developer utility
- a markdown-native workbench
- a persistent workflow buffer
- a lightweight prompt library
- a stable daily-use desktop tool

It should **not** feel like:
- a bloated notes app
- a consumer productivity suite
- an AI orchestration platform
- a prompt marketplace
- a half-finished file viewer

---

## If the repo is very incomplete

If the current repository is only a rough prototype and lacks major infrastructure, you may establish a clean baseline implementation, but:

- keep it within the scope of the spec
- do not gold-plate architecture
- ensure required flows are fully working before adding polish
- preserve any valuable visual/theme direction already present where practical

---

## Final instruction block to execute

Read the spec. Inspect the repository. Compare current implementation against the spec. Build the missing capabilities end-to-end. Fix broken UX structure, especially tabs and top-bar usability. Implement the shelf and prompt library as first-class capabilities. Ensure local persistence, autosave, and session restore work. Add tests and run them. Validate the required user flows manually and with automation. Only declare the task complete when the app is working, tested, and aligned with the acceptance criteria. Document every meaningful deviation.

---

## Optional short version

If you need a tighter version for a smaller prompt window, use this:

Build the attached Scratchpad Workbench spec as the source of truth. First inspect the repo and identify the current stack, existing features, missing features, and broken UX relative to the spec. Then implement the missing capabilities end-to-end: markdown/yaml open-edit-preview-save, drag/drop open, stable tab system, persistent shelf for text/code/images, prompt library, local persistence, autosave/session restore, search/filter, and required settings/shortcuts. Preserve the current repo stack when reasonable. Do not overbuild or add out-of-scope features. Add tests, run them, validate the critical user flows manually and through e2e, fix defects, and only report done when the app is working and acceptance criteria are satisfied. Document any deviations clearly.
