# Brief: Markdown Clipboard Converter (Menubar App)

## Intent

People copy markdown from LLMs constantly and have no fast way to turn it into something usable — rich text for email, DOCX for sharing, PDF for archiving. This app sits in your menubar and does that one thing well.

## Problem

- LLMs (ChatGPT, Claude, Gemini) output markdown by default
- Pasting raw markdown into Google Docs, email, Slack, etc. looks broken
- Current workflow: paste into a markdown editor, export, open export, copy again
- That's 4+ steps for something that should be one click

## Product

A macOS menubar utility. No main window. No file management. Just clipboard conversion.

### Core Flow
1. User copies markdown from an LLM or any source
2. App detects markdown in clipboard (or user clicks the menubar icon)
3. Small popup shows rendered preview
4. User clicks: "Copy as Rich Text", "Save as PDF", or "Save as DOCX"
5. Done

### Features (MVP)
- Menubar icon with dropdown
- Clipboard markdown detection (manual trigger at minimum, auto-detect as stretch)
- Rendered preview in a small popup (300-400px wide)
- Copy as Rich Text (paste directly into Google Docs, email, Slack)
- Save as PDF
- Save as DOCX
- Keyboard shortcut for quick convert (e.g., global hotkey: Ctrl+Shift+V to paste as rich text)

### Features (Post-MVP)
- Auto-detect markdown in clipboard and show notification
- Conversion history (last 10-20 items)
- Template styling (choose how the output looks)
- Batch convert: drop multiple .md files, get PDFs/DOCX back
- "Paste as Rich Text" system service (appears in right-click menu)

## Technical Direction

- **Tauri v2** — you already know the stack, menubar/system tray is supported
- **Rust side**: clipboard watching, system tray, global hotkey registration
- **Frontend**: minimal HTML/CSS popup for preview, reuse markdown-it + DOMPurify
- **DOCX generation**: `docx` npm package or `html-to-docx`
- **PDF**: Tauri webview print-to-PDF or a lightweight Rust PDF lib

### Key Tauri Considerations
- `tauri-plugin-global-shortcut` for hotkeys
- `tray` API for menubar icon and menu
- No main window needed — popup only on demand
- App bundle will be small (~10-15MB)

## Audience

- Knowledge workers who use LLMs daily
- Non-technical — they don't know what markdown is, they just want it to look right
- Writers, marketers, PMs, students, consultants

## Positioning

"One click to make AI output look professional."

Not a markdown editor. Not a notes app. A conversion utility.

## Business Model Options

1. **Free + open source** — portfolio piece, build reputation
2. **One-time purchase $9-19** — via Gumroad/Paddle, no App Store
3. **Freemium** — free for rich text copy, paid for PDF/DOCX export

Option 2 is probably the sweet spot if revenue is a goal. Low enough for impulse buy, high enough to justify the work.

## Success Criteria

- Clipboard to rich text in under 3 seconds
- Works without opening any window (menubar → click → done)
- Non-technical user can figure it out without instructions
- App uses <50MB memory idle

## Open Questions

- Auto-detect markdown in clipboard — feasible without polling? (macOS pasteboard notifications exist but are limited)
- Global hotkey conflicts — what's safe to claim?
- Windows/Linux support or macOS-only for MVP?
- Name?

---

## Appendix A: Commercialization Analysis

### Commercial Viability

This product has a stronger commercial case than a general markdown editor because:
- **Single clear problem** — easy to explain and market
- **No direct competition** — no established "clipboard markdown converter" exists
- **Tiny scope** — fast to build, low maintenance burden
- **Non-technical audience** — willing to pay for convenience

### Distribution Options

**Mac App Store**
- Viable for a menubar utility — simpler to sandbox than a full editor
- Apple more lenient with small utilities in review
- Tauri system tray approach should pass if sandboxing is handled correctly
- Downsides: 30% cut (year 1), 15% (year 2+), review friction

**Chrome Web Store (Alternative Product Form)**
- Browser extension that detects markdown on LLM pages (ChatGPT, Claude, etc.)
- Adds "Copy as Rich Text" button next to LLM responses
- No clipboard watching needed — already in the browser where markdown originates
- Better product-market fit for the browser-based use case
- Reaches Windows/Linux automatically
- Downside: no DOCX/PDF export (browser extensions can't easily generate files)
- Could exist as a companion product alongside the native app

**Direct Sales (Gumroad/Paddle)** — Recommended starting point
- Lowest friction to ship and iterate
- Keep ~93% of revenue (vs 70% on App Store)
- Can add App Store listing later once demand is validated

### Pricing Analysis

| Model | Price | Pros | Cons |
|-------|-------|------|------|
| One-time | $9-14 | Impulse buy, no churn | Revenue stops growing |
| One-time | $19-29 | Better per-sale | Harder sell for a utility |
| Subscription | $1.99/mo | Recurring revenue | Hard to justify for a utility |
| Freemium | Free + $9 upgrade | Funnel, lower friction | Splits audience |

**Recommendation: $9.99 one-time via Gumroad.**
- Under the "do I really need this?" threshold
- Subscriptions feel wrong for a small utility — people resent recurring charges
- Direct sales preserve margin; App Store can come later

### Go-to-Market Strategy

1. Build MVP fast by reusing Pike Markdown's rendering pipeline (markdown-it, DOMPurify, rich text copy, PDF export)
2. New work is scoped: system tray, clipboard reading, popup UI, DOCX generation
3. Ship minimal, post to Hacker News and Reddit to validate demand
4. If traction appears, invest in polish, App Store listing, and marketing
5. Don't spend months polishing before validating

### Revenue Scenarios

- 100 sales at $9.99 = ~$930 (Gumroad) — validates demand
- 500 sales = ~$4,650 — justifies ongoing development
- 1,000 sales = ~$9,300 — solid side-project income

### Risk Assessment

- **Low downside**: MVP is a couple weekends of work reusing existing code
- **Main risk**: building too much before validating demand
- **Mitigation**: ship ugly, test cheap, scale only if people buy
