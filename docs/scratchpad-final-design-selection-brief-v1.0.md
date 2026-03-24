# Scratchpad — Final Design Selection Brief (v1.0)

**Purpose:** Finalize the v1 product design direction so implementation can proceed without screen-level ambiguity.  
**Audience:** Codex, product designer, frontend engineer  
**Scope:** v1 build selection + v2/P2 backlog containment

---

# 1. Executive Decision

The v1 product direction is now locked.

## Product identity
**Scratchpad** remains the primary product name for v1.

Rationale:
- It matches the existing build spec and Codex handoff materials.
- It is broad enough to support markdown, shelf, prompt library, and sessions.
- It does not prematurely narrow the product into “agent operations.”

**Agentpad** may be reconsidered later as a brand variant, but it is **not** the v1 implementation name.

---

# 2. Design Authority

## Approved design system authority
Use the **Monolithic Workbench** design system as the visual and interaction authority for v1.

## Why this is the authority
It is sharper, more implementation-friendly, and more aligned with the strongest latest screens:
- monolithic architectural aesthetic
- tonal layering instead of border-heavy sectioning
- compact utilitarian shelf cards
- integrated top bar
- sparse accent usage
- editorial headline treatment
- no glass / no gradients / no decorative softness

## Core rules to preserve
- no 1px divider-based sectioning
- no pure black surfaces
- no large rounded corners
- no dashboard-card styling for ordinary utility content
- no decorative analytics UI unless it is truly part of the shipped product
- keep the interface receded so the markdown-native workflow remains primary

---

# 3. Final v1 Product Boundary

Scratchpad v1 is:

- a markdown-native desktop workbench
- a fast document viewer/editor
- a persistent workflow buffer
- a reusable prompt library
- a shelf-driven staging environment
- a local-first utility for active work

Scratchpad v1 is **not**:

- a prompt operations platform
- a deployment console
- a benchmarking/evaluation platform
- a dataset management app
- a knowledge graph / PKM suite
- a governance or production prompt release platform

---

# 4. Approved v1 Information Architecture

## Primary navigation
Use this exact left-rail structure for v1:

1. Workspace
2. Library
3. Shelf
4. Sessions
5. Search
6. Settings

## Explicitly excluded from v1 navigation
Do **not** include these in the primary nav for v1:
- Dashboard
- Evaluations
- Datasets
- Deploy
- Comparison Engine

These belong in backlog / later-phase exploration only.

---

# 5. Final Screen Family Decisions

## A. Main Workspace — APPROVED
This is the default home shell of the product.

### Role
The operational core of the app:
- open/edit markdown and YAML
- switch between source / split / preview
- manage tabs
- stage and reuse shelf items

### Required layout
- slim left rail
- integrated top bar
- stable tab row
- dominant central editor/document area
- narrower right-side Active Shelf panel

### Why approved
This is the clearest expression of the product:
- document remains primary
- shelf is present but secondary
- workflow feels immediate
- shell feels like a serious desktop utility

### Required refinements
- standardize top bar structure
- ensure tab overflow behaves cleanly
- reduce shelf visual noise
- keep document surface visually dominant
- use compact shelf cards by default

---

## B. Prompt Library — APPROVED
This is a first-class mode within the same product shell.

### Role
A reusable prompt/document asset manager that supports:
- browsing
- editing
- organizing
- copying
- duplicating
- moving prompts to shelf

### Required layout
- left rail
- category/filter column
- list column
- dominant editor/detail pane
- thin metadata/actions rail

### Why approved
It proves prompt reuse belongs naturally inside the workbench without turning the app into a separate prompt-management product.

### Required refinements
- keep categories narrower
- keep editor pane dominant
- keep metadata rail lightweight
- remove fake analytics/performance scoring
- reduce form-admin feel

---

## C. Shelf View — APPROVED
This is a dedicated capture/staging mode.

### Role
A persistent workflow buffer for:
- snippets
- code blocks
- pasted images
- prompt drafts
- quick notes
- references

### Why approved
It reinforces the real differentiator of the product:
the ability to capture, stage, and reuse work fragments while moving across tools.

### Required refinements
- keep shelf cards compact and utilitarian
- image cards may be richer; text/code cards must remain dense
- selected reading/content area must stay calmer than the shelf stack
- this is a dedicated mode, not the default home shell

---

## D. Vault / File-Manager Style Library — REVISE INTO LIBRARY
This direction is not fully rejected, but it should not become a separate product identity.

### Decision
Fold the strongest parts into **Library mode**, but do **not** position the product as a “Vault” or PKM system.

### Keep
- good list/table discipline
- collection grouping ideas
- file/document scanability

### Cut
- “vault” framing
- overemphasis on archival/file-manager identity
- product drift toward long-term knowledge base software

---

## E. Comparison Engine / Version / Deploy Direction — REJECT FOR V1, BACKLOG FOR P2
This direction is explicitly **out of scope for v1**.

### Why rejected for v1
It changes the product from:
- markdown-native workbench

into:
- prompt operations / release management platform

It introduces major scope growth:
- version lanes
- compare workflows
- schema/variable validation
- deploy semantics
- evaluation architecture
- datasets and production workflows

That is too large and too different for the v1 product.

### Status
Move to **P2 backlog** only.

---

# 6. Final v1 Layout Rules

## 6.1 Default shell
Use the **Main Workspace** layout as the default shell.

## 6.2 Document primacy
The active document/editor must remain the primary visual focus in all working modes.

## 6.3 Shelf hierarchy
The shelf is:
- always useful
- always available
- visually secondary
- compact by default

## 6.4 Top bar
Standardize all v1 screens around one top bar system:

### Left
- brand
- current context if needed

### Center
- mode controls or tab context

### Right
- quick open/search
- new item
- overflow/help/profile as needed

No screen should invent a completely new top-bar pattern.

## 6.5 Tab system
Tabs must be:
- stable
- non-overlapping
- realistically dense
- overflow-safe
- obviously active/inactive

## 6.6 Card density
Use two card densities only:

### Compact utility cards
For:
- snippets
- prompt drafts
- notes
- references
- code blocks

### Rich cards
For:
- images
- rare large featured assets in library contexts

Do not let all cards become gallery cards.

---

# 7. Visual Rules for Codex

Codex should implement the UI using these rules:

## Surfaces
- deep charcoal/graphite tonal layers
- no pure black
- no glass
- no gradients
- no decorative shadows
- tonal stepping only

## Borders and separation
- avoid explicit 1px borders for structural separation
- prefer background shifts and spacing
- if a fallback border is truly needed, use extremely subtle ghost-border treatment

## Typography
- editorial, high-authority headlines
- compact utilitarian UI/metadata text
- main content must feel premium but readable for long sessions

## Accent usage
Accent color is a utility signal only:
- active nav state
- caret/selection signal
- primary action button
- small number of focused interaction states

Do not decorate the interface with accent color.

## Corners
- sharp or nearly sharp
- no large-radius consumer styling

---

# 8. v1 Build Scope Lock

Codex should build only these product surfaces for v1:

## Must build
- Main Workspace
- Library mode
- Prompt Library behavior
- Shelf mode
- Sessions
- Search
- Settings
- stable tab system
- source / split / preview
- local persistence
- autosave
- session restore

## Must not expand into
- prompt comparison platform
- dataset manager
- evaluation center
- deployment pipeline
- release promotion workflow
- governance console

---

# 9. P2 Backlog — Deferred Product Directions

These are valid future directions, but they are **not part of v1**.

## P2.1 Prompt Version History
Basic future capability:
- version timeline
- named saved versions
- restore older version
- duplicate from version

## P2.2 Prompt Comparison View
Future capability:
- side-by-side compare
- diff highlighting
- metadata deltas
- optional sync scrolling

Keep this lightweight unless it proves real value.

## P2.3 Variable / Schema Validation
Future capability:
- detect unresolved placeholders
- schema mismatch warnings
- variable inventory inspection
- prompt template validation

## P2.4 Prompt Release / Deploy Workflow
Future capability if the product actually evolves into production prompt release tooling:
- mark version as draft / approved / release candidate
- export bundle
- push to target system
- change audit trail

This is **not** a v1 feature.

## P2.5 Evaluations
Future capability:
- lightweight prompt test cases
- sample outputs
- score notes
- human review summaries

Do not build now.

## P2.6 Datasets / Structured Inputs
Future capability:
- reusable variable sets
- scenario libraries
- prompt input packs

Do not build now.

---

# 10. Final Approve / Revise / Reject Summary

## APPROVE
- Main Workspace shell
- Prompt Library mode
- Shelf mode
- Monolithic Workbench design system

## REVISE
- Vault/file-manager library ideas -> fold into Library mode
- naming consistency across screens
- top bar consistency
- tab density / overflow behavior
- shelf card density hierarchy

## REJECT FOR V1
- Comparison Engine
- Deploy actions
- Evaluations
- Datasets
- prompt ops platform drift

---

# 11. Implementation Guidance for Codex

Codex should interpret this brief as follows:

1. The v1 product is a **workbench**, not a platform.
2. The **Main Workspace** is the primary home screen.
3. The **Prompt Library** is a mode inside the same system.
4. The **Shelf** is a first-class differentiator, but remains visually secondary.
5. The **Monolithic Workbench** design system is the visual authority.
6. P2 backlog items must not leak into the v1 build unless explicitly requested later.

If a design decision is ambiguous, default to:
- simpler
- tighter
- flatter
- more operational
- less dashboard-like
- less platform-like

---

# 12. Final Build Instruction

For v1, build the smallest coherent product that fully delivers:

- markdown-native workbench
- shelf-based staging
- reusable prompt library
- stable multi-tab editing
- local persistence
- session continuity
- low-noise premium desktop-tool UI

Everything else is secondary.
