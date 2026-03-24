# Scratchpad — Codex Build Package (v1.0)

**Purpose:** Single package note describing which documents Codex should use, in what order, and what each one controls.

---

# 1. Package Contents

Use these documents together:

## A. End-to-End Product & Implementation Spec
**File:** `scratchpad-workbench-end-to-end-spec-v1.0.md`

This is the **build authority** for:
- scope
- features
- architecture recommendations
- data model
- persistence
- testing
- acceptance criteria
- definition of done

## B. Codex Execution Prompt
**File:** `codex-execution-prompt-scratchpad-workbench-v1.0.md`

This controls **how Codex should work**:
- inspect the repo first
- compare implementation against the spec
- preserve the current stack when sensible
- build missing capabilities
- test and validate before declaring done

## C. Final Design Selection Brief
**File:** `scratchpad-final-design-selection-brief-v1.0.md`

This controls **design and product-boundary decisions**:
- approved v1 screen families
- approved navigation
- approved visual system direction
- rejected v1 directions
- P2 backlog containment

---

# 2. Authority Order

When there is ambiguity, use this priority order:

## Priority 1
`scratchpad-workbench-end-to-end-spec-v1.0.md`

## Priority 2
`scratchpad-final-design-selection-brief-v1.0.md`

## Priority 3
`codex-execution-prompt-scratchpad-workbench-v1.0.md`

Interpretation:
- the end-to-end spec defines the product and implementation scope
- the design selection brief resolves screen-direction and design-boundary ambiguity
- the execution prompt tells Codex how to proceed operationally

---

# 3. v1 Build Target

Codex should build only this v1 product:

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

Do **not** let Codex expand the product into:
- Comparison Engine
- Deploy workflows
- Evaluations
- Datasets
- prompt operations platform behavior

Those are explicitly deferred to P2.

---

# 4. Design Authority

For visual and interaction direction, use the **Monolithic Workbench** system, implemented through the final design selection brief.

That means:
- dark graphite tonal layering
- no glass
- no gradients
- no decorative metrics dashboards
- compact utility shelf cards
- integrated top chrome
- document-first hierarchy
- accent color used sparingly and operationally

---

# 5. Screen Priority

Codex should implement in this order:

## 1. Main Workspace
This is the home shell and highest-priority screen.

## 2. Shelf behavior inside the workspace
This is the core differentiator.

## 3. Prompt Library / Library mode
This is the main reusable-asset workflow.

## 4. Sessions / Search / Settings
These complete the v1 operational surface.

---

# 6. Working Rule for Codex

If Codex encounters ambiguity, default to:
- less product sprawl
- fewer surfaces
- tighter navigation
- smaller feature set
- stronger document focus
- more utilitarian shelf
- less platform behavior

This product should ship as a **solid daily-use workbench**, not as a speculative prompt platform.

---

# 7. Suggested Codex Launch Prompt

Use language like this when starting Codex:

> Use the attached Scratchpad build package as the source of truth.  
> The end-to-end spec defines the product and acceptance criteria.  
> The final design selection brief resolves the approved v1 screen directions and explicitly excludes P2 prompt-platform features.  
> The Codex execution prompt defines how you should inspect the repo, implement, test, validate, and report.  
> Build the v1 workbench only. Do not expand into comparison/deploy/evaluation/dataset workflows.  
> Do not report done until the app is working, tested, and aligned with the package.

---

# 8. Final Packaging Note

This package is intended to reduce drift.

The build target is now locked to:

- a markdown-native workbench
- a persistent shelf
- a prompt library
- stable tabs
- local persistence
- session continuity
- a monolithic, low-noise desktop UI

That is the product.
