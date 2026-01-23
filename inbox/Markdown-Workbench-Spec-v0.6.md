---
title: "Markdown Workbench — Product & Governance Specification"
version: "0.6"
status: "draft"
owner: "Team"
updated: "2026-01-22"
---

# Markdown Workbench — Product & Governance Specification

## 1. Vision

Markdown Workbench is a desktop-first Markdown editor treating Markdown as a **governed single source of truth**. Combines developer rigor (Git, deterministic formatting) with enterprise governance (schemas, approvals, audit) and human-friendly UX.

---

## 2. Core Principles

1. **Markdown as canonical artifact**
2. **Dual-mode editing** (Raw + Preview, no implicit mutation)
3. **Deterministic formatting** (versioned, pinned)
4. **Engine/UI separation** (headless Go engine + thin Tauri client)

---

## 3. Architecture

### 3.1 Core Engine (Go)

- CommonMark parsing
- YAML front matter + schema validation
- Deterministic formatting
- AST-aware diff
- Git integration (read + limited governance write)
- Dual-hash integrity (RFC 8785 JCS)
- Conflict marker handling

**Recommended Libraries:**

| Function | Library |
|----------|---------|
| JCS canonicalization | `cyberphone/json-canonicalization` (reference impl) |
| Markdown parsing | `yuin/goldmark` |
| YAML | `go-yaml/yaml` |
| Git operations | `go-git/go-git` |

### 3.2 Parser Resilience

**Large File Handling:**

| Size | Behavior |
|------|----------|
| ≤500KB | Full functionality |
| 500KB–2MB | Truncated preview |
| >2MB | Safe Mode (text-only) |

**Base64 Detection:** Nodes >100KB → placeholder + [Extract to Asset].

**Safe Mode:** Edit/save allowed. Format/preview/validate disabled. [Re-parse] to exit.

### 3.3 Git Integration

**Scope:**

| Capability | Scope |
|------------|-------|
| Read history/metadata | Full |
| Detect changes | Full |
| **Governance commits** | Limited |
| **Content commits** | Optional (see 3.3.2) |
| Push/pull/branch | Out of scope |

#### 3.3.1 Governance Auto-Commit

Triggers on approval/rejection. Commits only governance fields.

**Commit message:**

```
governance: <action> "<title>"

Document: <doc_id>
User: <git email>
```

**On failure (hooks, permissions, signing):**

1. Status reverts to pre-action state (e.g., stays `Review`)
2. Error shown with Git output
3. Options: [Retry] [Manual Instructions]

Approval is **not recorded** until commit succeeds. No "pending commit" state.

**GPG Signing:**

- If repo requires signing (`commit.gpgsign=true`), governance commits are signed
- If signing fails (no key, passphrase timeout): commit fails, approval blocked
- Workaround: user can disable signing or fix GPG setup

**Pre-commit Hooks:**

- Governance commits run through hooks normally
- If hooks fail: commit fails, approval blocked
- Rationale: hooks are repo policy; app respects them

#### 3.3.2 Content Commit (Optional)

For the "fix typo then approve" flow:

**Trigger:** User clicks Approve with uncommitted content changes.

**Dialog:**

```
Uncommitted content changes detected.

[Commit Content & Approve] — Commits content, then approves
[Cancel] — Return to editing
```

**"Commit Content & Approve" behavior:**

1. Stage file: `git add <file>`
2. Commit content: `git commit -m "content: update <title>"`
3. Verify commit succeeded
4. Proceed with governance approval (separate commit)

**Constraints:**

- Only available if **sole uncommitted change** is this file
- If other files are dirty: blocked, user must handle externally
- Commit message is fixed (not user-editable in this flow)

This eliminates context-switching for simple edits while keeping complex Git scenarios external.

---

## 4. Document Model

### 4.1 Front Matter

```yaml
---
doc_id: "550e8400-e29b-41d4-a716-446655440000"
title: "Document Title"
version: "1.2.0"
status: "draft"
owner: "team-name"
last_modified_by: "git:user@example.com"
last_modified_on: "2026-01-22T10:15:00Z"
content_hash: "sha256:a1b2c3..."
governance_hash: "sha256:d4e5f6..."
approval_policy:
  required_count: 2
  mode: "any-of"
  approvers: ["role:security"]
approval_log:
  - by: "git:approver@example.com"
    on: "2026-01-20T14:02:00Z"
    commit: "abc123f"
    comment: "Approved"
tags: ["policy"]
---
```

### 4.2 Authority Contract

| Field | Source | Editable | Mismatch |
|-------|--------|----------|----------|
| `doc_id` | Tool | No | Error |
| `title`, `version`, `owner`, `tags` | Human | Yes | Recalc governance_hash |
| `status` | Tool | No | Reconciliation dialog |
| `last_modified_*` | Git | No | Reconciliation dialog |
| `*_hash` | Tool | No | Reconciliation dialog |
| `approval_policy` | Human (UI) | No in Raw | See 5.5.4 |
| `approval_log` | Tool | No | Verify vs Git |

**Reconciliation:** Dialog with [Accept Authoritative] [Cancel]. No silent reversion.

### 4.3 Dual-Hash Model

| Hash | Covers |
|------|--------|
| `content_hash` | Body after front matter (normalized) |
| `governance_hash` | JCS of {title, version, owner, tags, approval_policy} |

**JCS (RFC 8785):** Deterministic JSON serialization. Keys sorted lexicographically, arrays preserved, UTF-8 normalized.

### 4.4 `last_modified_*` Semantics

**Definition:** Refers to the last **content-changing** commit (body or governance fields that trigger hash change).

**Excludes:** Governance-only commits that don't change content (pure approval record additions).

**Derivation:**

1. Walk Git history for this file
2. Find most recent commit where `content_hash` or `governance_hash` differs from parent
3. Extract author email and timestamp

### 4.5 Content Committed Verification

**Algorithm:**

```
1. working_body = read body from working tree (this file)
2. head_body = read body from HEAD:<path> (git show HEAD:<path>)
3. working_hash = SHA256(normalize(working_body))
4. head_hash = SHA256(normalize(head_body))
5. committed = (working_hash == head_hash) AND (no conflict markers)
```

**Normalization:**

- Convert CRLF → LF
- Trim trailing whitespace per line
- Ensure single trailing newline

**Git Filters (LFS, clean/smudge):**

- Hash computed on **checkout content** (post-filter), not blob
- Rationale: user sees checkout content; that's what they're approving

**Submodules:** Out of scope. Submodule paths are not valid document locations.

---

## 5. Directive Blocks

### 5.1 Grammar (v1)

```
directive := fence_open content fence_close
fence_open := ":::" name [attributes]
fence_close := ":::"
```

**Recognition:**

- Fence at **column 0 only**
- **Not parsed** inside code fences or block quotes
- Escape: `\:::`

### 5.2 Escaping Inside Directive Bodies

**Problem:** Snippet contains `:::` at column 0.

**Rule:** Closing fence `:::` is recognized only if:

1. At column 0, AND
2. Followed by EOF or blank line or another fence

**Inside snippet bodies:**

- `:::` followed by non-blank content on same line → literal text
- `:::` alone on line → closes directive

**Alternative fence (for complex cases):**

```markdown
::::snippet lang="markdown"
:::example
nested content
:::
::::
```

Four colons `::::` for outer, three `:::` for content. Parser matches fence length.

### 5.3 Block Types

**Agent:** Body is opaque text (not validated).

**Disclosure:** `level` and `title` validated. Body is Markdown.

**Snippet:** `lang` required. Body is preformatted.

---

## 6. Governance Model

### 6.1 Workflow States

Draft → Review → Approved/Rejected

### 6.2 Approval Preconditions

1. Content committed (Section 4.5 algorithm)
2. Status = Review
3. User has Approver role
4. Validation passes

**Failure with dirty content:**

```
[WHAT] Uncommitted content changes
[WHY] Approvals reference Git commits
[FIX] [Commit Content & Approve] or use external Git
```

### 6.3 Approval Execution

1. Verify preconditions
2. Update governance fields
3. Auto-commit governance changes
4. If commit fails → revert, show error
5. If commit succeeds → approval complete

### 6.4 Content Change Triggers

| Change | Triggers Approved → Draft |
|--------|---------------------------|
| Body text | Yes |
| Directive content | Yes |
| title/version/owner/tags | Yes |
| Whitespace normalization | No |
| Tool-managed fields | No |
| Comments | No |

### 6.5 Approval Policy Changes

| Status | Change Allowed |
|--------|----------------|
| Draft | Yes |
| Review | Yes |
| Approved | No (must Draft first) |

---

## 7. Permissions

### 7.1 Roles

Reader, Editor, Reviewer, Approver, Agent

### 7.2 Identity Resolution

```yaml
# .mdw/identities.yaml
users:
  jane@example.com:
    aliases: ["jdoe@old.com"]
    roles: [approver, editor]
roles:
  security: ["security@example.com"]
```

**Resolution order:**

1. Match git email against `users` (including aliases)
2. If matched: use explicit roles
3. Else: scan `roles`/`groups`
4. Tie-breaker: Approver > Editor > Reviewer > Reader

**Signed commits:** Prefer signer email (best-effort extraction via `git log --format=%GS`).

**UI Display:** Show "Jane Doe (via jdoe@old.com)" when alias matched.

### 7.3 Enforcement Levels

| Level | Behavior |
|-------|----------|
| `advisory` | Warning, proceed |
| `blocking` | Error, blocked |

### 7.4 Permissions × Actions Matrix

| Action | Required Role | Advisory | Blocking |
|--------|---------------|----------|----------|
| View | Reader | — | — |
| Edit body | Editor | Warn | Block save |
| Edit metadata (UI) | Editor | Warn | Block save |
| Format | Editor | Warn | Block |
| Submit for review | Editor | Warn | Block |
| Add comment | Reviewer | Warn | Block |
| Approve/Reject | Approver | Warn | Block |
| Export | Reader | — | — |
| Export (unsanitized) | Editor | Warn | Block |

**Format under Approved status:** Blocked for all roles (would trigger Draft).

---

## 8. Comments

### 8.1 Storage (Inline)

```markdown
<!-- @comment id="1" author="git:jane@example.com" ts="..." anchor="h:## Overview|c:abc123|s:Clarify|i:0"
Comment text
-->
```

### 8.2 Anchor Format

```
h:<heading_path>|c:<context_hash>|s:<snippet>|i:<index>
```

- `h:` Heading path
- `c:` Hash of ±50 chars
- `s:` First 20 chars
- `i:` Occurrence index (0-based) for disambiguation

**Re-anchoring:**

1. Search same heading section
2. Match context hash
3. If multiple: use index, else highest snippet overlap
4. No match: mark orphaned

### 8.3 Comment Recovery

Malformed comment → "Damaged Comment" node → [Repair] wizard.

### 8.4 Comments and Formatting

- Formatter preserves comment position relative to surrounding content
- Comments do not affect validation
- Comments do not create formatting boundaries (content reflows around them)

### 8.5 Damaged Comments in Export

- **Default:** Stripped (like normal comments)
- **Internal profile:** Rendered as highlighted callout: `[⚠ Damaged Comment: "partial text..."]`

---

## 9. House Style Formatter

### 9.1 Rule Set v1

| Rule | Behavior |
|------|----------|
| Paragraph wrapping | **No hard breaks** (single logical line) |
| Heading spacing | 1 blank before/after |
| List indent | 2 spaces |
| List markers | `-` unordered, `1.` ordered |
| Tables | Align columns |
| Trailing whitespace | Remove |
| Final newline | Single |
| Blank lines | Collapse 3+ to 2 |
| Code fence | Backticks |
| Emphasis | `*italic*`, `**bold**` |

**No hard breaks:** Editor soft-wraps. File has one line per paragraph. Ensures diff stability.

### 9.2 Guarantees

- Idempotent
- Semantic preservation
- Boundary preservation
- Diff stability

---

## 10. Export

### 10.1 Formats

HTML, PDF, DOCX, Google Docs, JSON (metadata).

### 10.2 Sanitization Profiles

```yaml
# .mdw/config.yaml
export:
  default_profile: "external"
  profiles:
    external:
      strip: [agent, comments, damaged_comments]
    internal:
      strip: [agent]
      render_comments: true
      render_damaged: "callout"
```

**Default (no config):** Strip agent blocks and all comments.

### 10.3 Fidelity

| Element | HTML | PDF | DOCX | GDocs |
|---------|------|-----|------|-------|
| Headings | ✓ | ✓ | ✓ | ✓ |
| Lists | ✓ | ✓ | ✓ | ✓ |
| Tables | ✓ | ✓ | ✓ | Best-effort |
| disclosure | `<details>` | Heading | Heading | Heading |
| agent | Stripped | Stripped | Stripped | Stripped |

### 10.4 Google Drive

**v1:** Local sync only. Export to filesystem.

---

## 11. UX

### 11.1 Git Status Panel

| State | Label |
|-------|-------|
| Clean | ✓ Saved & Tracked |
| Modified | ⚠ Unsaved Changes |
| Untracked | ● New File |
| Conflict | ⚠ Merge Conflict |

### 11.2 Error Format

```
[WHAT] Problem
[WHY] Impact
[FIX] Action
```

### 11.3 Identity Display

When alias matched: "Jane Doe (via jdoe@old.com)"

When role derived: "Jane Doe • Approver (security)"

---

## 12. CLI

| Command | Description |
|---------|-------------|
| `mdw validate` | Run validations |
| `mdw fmt` | Format |
| `mdw diff` | Diff vs commit |
| `mdw audit` | History |
| `mdw export` | Export |
| `mdw init` | Add front matter |
| `mdw verify` | Check integrity |
| `mdw repair` | Reset to Draft |
| `mdw restore` | Compare to approved |

---

## 13. Configuration

```yaml
# .mdw/config.yaml
schema: "policy-doc-v1"
formatter:
  ruleset: "v1"
permissions:
  enforcement: "blocking"
export:
  default_profile: "external"
```

---

## 14. Security

- macOS signing/notarization
- Sandbox compliance
- Dual-hash tamper detection
- Agent blocks always stripped
- Governance commits use user's Git identity
- GPG signing respected

---

## 15. Performance

| Target | Value |
|--------|-------|
| ≤500KB | Full |
| Parse | <100ms |
| Format | <200ms |

---

## 16. Conformance Test Suite v1

### 16.1 Formatter Golden Files

Location: `test/golden/formatter/`

| Test | Input | Expected |
|------|-------|----------|
| paragraph_wrap | Multi-line paragraph | Single line |
| heading_spacing | No blank lines | 1 before/after |
| list_normalize | Mixed markers | `-` and `1.` |
| table_align | Ragged table | Aligned |

### 16.2 Directive Parsing

| Test | Input | Expected |
|------|-------|----------|
| basic_agent | `:::agent ... :::` | AgentNode |
| nested_disclosure | `:::disclosure` inside `:::disclosure` | Nested nodes |
| escape_fence | `\:::` | Literal text |
| snippet_with_fence | `:::` inside snippet | Literal (not close) |
| unclosed | `:::agent` no close | Warning + plain text |

### 16.3 Governance

| Test | Scenario | Expected |
|------|----------|----------|
| approve_clean | Content committed | Success |
| approve_dirty | Content uncommitted | Block or Commit & Approve |
| tamper_body | content_hash mismatch | Reset to Draft |
| tamper_governance | governance_hash mismatch | Reset to Draft |
| policy_change_approved | Change policy when Approved | Block |

### 16.4 Content Committed Check

| Test | Scenario | Expected |
|------|----------|----------|
| crlf_lf | CRLF in working, LF in HEAD | Committed (normalized) |
| trailing_ws | Extra trailing space | Committed (normalized) |
| conflict_markers | `<<<<<<<` present | Not committed |

---

## 17. Roadmap

| Phase | Deliverables |
|-------|--------------|
| v0.1–0.2 | Editor, formatter |
| v0.3 | Git read, audit |
| v0.4 | Workflow, approvals |
| v0.5 | Auto-commit, comment recovery |
| v0.6 | Content commit option, sanitization profiles, conformance tests |
| v0.7 | Templates, snippets |
| v0.8 | Web viewer |
| v1.0 | App Store |

---

## 18. Decisions Log

| Question | Decision |
|----------|----------|
| Governance commit | Yes (auto) |
| Content commit in app | Yes (optional, single-file only) |
| Silent reversion | No |
| Paragraph wrapping | No hard breaks |
| JCS library | `cyberphone/json-canonicalization` |
| Hook/signing failure | Blocks approval |
| Sidecar comments | Deferred v2 |
| Directive nesting in lists | Not supported |

---

## 19. Open Questions

1. Plugin API (WASM validators)?
2. Multi-document bundles?
3. Real-time collaboration (v3)?

---

## 20. Revision History

| Version | Changes |
|---------|---------|
| v0.1–0.4 | Foundation, workflow, permissions |
| v0.5 | Governance auto-commit, comment recovery |
| v0.6 | Content commit option, verification algorithm, permissions matrix, sanitization profiles, conformance suite, directive escaping, last_modified semantics, JCS library, hook/signing behavior |
