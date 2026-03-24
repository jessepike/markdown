# Prompt to Update `AGENTS.md` for Scratchpad v1

Use this prompt with Codex or your implementation agent to update the existing `AGENTS.md` file without replacing prior repo-specific guidance.

```text
Update the existing root `AGENTS.md` file for this repository.

Important constraints:
- Do not replace the file wholesale unless absolutely necessary.
- Preserve all existing repo-specific instructions unless they directly conflict with the new Scratchpad v1 product direction.
- Integrate the new guidance cleanly into the existing structure.
- Prefer minimal, surgical edits.
- Keep the file practical and operational.
- After updating, provide a concise summary of what was added or changed.

Context:
This repo is building Scratchpad v1, a markdown-native desktop workbench. The product direction, build scope, and visual authority have been locked during the current planning session.

Your job:
1. Read the current `AGENTS.md`.
2. Read these project docs if present:
   - `scratchpad-workbench-end-to-end-spec-v1.0.md`
   - `codex-execution-prompt-scratchpad-workbench-v1.0.md`
   - `scratchpad-final-design-selection-brief-v1.0.md`
   - `scratchpad-codex-build-package-v1.0.md`
3. Update `AGENTS.md` so it reflects the approved v1 direction without duplicating massive blocks of text unnecessarily.
4. Keep the instructions crisp, specific, and enforceable.

What the updated `AGENTS.md` should communicate:

## Product identity and scope
Add clear guidance that:
- The v1 product name is `Scratchpad`.
- Scratchpad v1 is a local-first, markdown-native desktop workbench.
- It includes:
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
- It does NOT include in v1:
  - Comparison Engine
  - Deploy workflows
  - Evaluations
  - Datasets
  - prompt ops platform behavior

## Product-shape rule
Add clear instruction that this product is:
- a workbench, not a platform
- document-first, with shelf and prompt library as supporting first-class capabilities
- optimized for active daily use, not broad product sprawl

## Design authority
Add a section that states:
- The visual and interaction authority for v1 is the `Monolithic Workbench` direction.
- The UI should favor:
  - dark graphite / charcoal tonal layering
  - no pure black
  - no glassmorphism
  - no gradients
  - sparse accent color
  - compact utility shelf cards
  - integrated top chrome
  - low-noise desktop-tool feel
- The interface should avoid:
  - dashboard energy
  - decorative analytics
  - consumer productivity styling
  - platform/admin-console styling unless explicitly required

## Approved screen hierarchy
Add guidance that:
- Main Workspace is the default home shell.
- Prompt Library is a mode inside the same system.
- Shelf is a dedicated capture/staging mode.
- The active document/editor should remain the primary visual focus.
- The shelf should remain visually secondary and compact by default.

## Design asset usage
Add instructions for how to use design artifacts in the repo:
- PNGs in `/docs/design/v1-approved/` are the visual authority for approved v1 screens.
- HTML files in `/docs/design/stitch-exports/` are structural prototype references only.
- Stitch HTML should not be copied into production unchanged.
- Patterns from Stitch exports should be ported into the real app architecture and component system.
- Any design artifacts under a `p2` folder are backlog reference only, not v1 scope.

## Navigation and naming
Add guidance that the primary nav for v1 is:
- Workspace
- Library
- Shelf
- Sessions
- Search
- Settings

Also note:
- Use `Scratchpad` consistently for v1.
- Do not mix `Scratchpad` and `Agentpad` in the current build.

## Implementation priorities
Add a short priority order:
1. correctness
2. usability
3. data safety
4. maintainability
5. visual polish

And add practical implementation preferences:
- preserve the current repo stack when sensible
- avoid unnecessary rewrites
- prefer incremental improvement over speculative architecture
- keep persistence simple and reliable
- do not widen scope

## UI implementation rules
Add a concise set of UI rules:
- tabs must not overlap or become unusable
- top bar should remain deterministic and uncluttered
- document/editor remains dominant
- shelf cards use compact density by default
- rich cards are mainly for images
- metadata panels should be lightweight
- prompt screens should feel like reusable working assets, not admin records

## P2 backlog containment
Add a short section that explicitly defers these to later phases:
- prompt version history
- prompt comparison view
- variable/schema validation
- release/deploy workflow
- evaluations
- datasets / structured inputs

## Repo-behavior rule
Add one operational rule:
- When there is ambiguity, default to the smaller, tighter, flatter, more operational solution that keeps the product within v1 workbench scope.

Editing approach:
- Merge this guidance into the current `AGENTS.md`.
- Avoid redundant repetition if similar instructions already exist.
- Keep the final document readable.
- Prefer short sections and bullets over long prose.

Output requirements:
- Update `AGENTS.md`.
- Then show:
  1. a concise summary of changes
  2. any conflicts you found with the previous file
  3. any recommended follow-up cleanup
```
