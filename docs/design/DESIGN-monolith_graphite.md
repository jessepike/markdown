```markdown
# Design System Strategy: The Monolithic Workbench

## 1. Overview & Creative North Star
**Creative North Star: The Brutalist Editor**

This design system is a rejection of the "consumer-grade" web. It moves away from the bubbly, high-contrast, and shadow-heavy interfaces of modern SaaS, opting instead for a **monolithic, architectural aesthetic**. We are building a "Digital Workbench"—a place where the interface recedes to let the user's markdown-native workflow take center stage.

The system breaks the "template" look through **intentional flatness** and **asymmetric information density**. Rather than using floating cards and rounded gradients, we define space through rigid tonal blocks and high-end editorial typography. It is structured, fast, and feels like a physical tool forged from graphite and steel.

---

## 2. Colors & Surface Logic
The palette is built on a narrow range of deep charcoals. The goal is "perceived blackness" without the eye strain of `#000000`.

### The Tonal Hierarchy
*   **Base Layer (`surface` / `#0e0e0e`):** The foundational substrate. Used for the primary editor area.
*   **Secondary Layer (`surface-container` / `#191a1a`):** Used for persistent sidebars and the top bar.
*   **Tertiary Layer (`surface-container-high` / `#1f2020`):** Used for interactive elements like shelf cards or active tab states.

### The "No-Line" Rule
Explicitly prohibit 1px solid borders for sectioning. Boundaries between the navigation rail, the file explorer, and the editor must be defined solely through background color shifts.
*   *Wrong:* A `#484848` border between the nav and editor.
*   *Right:* A `surface-container` (graphite) sidebar sitting flush against a `surface` (charcoal) editor.

### Accent Strategy
The `primary` blue (`#9fced8`) is a high-utility signal, not a decorative flourish. It should only appear in three places:
1.  **Cursor/Caret** in the active markdown line.
2.  **Active State Indicators** (e.g., a 2px vertical bar in the nav rail).
3.  **Primary Action Buttons** (sparingly).

---

## 3. Typography: Editorial Authority
We pair a technical geometric sans with a highly legible workhorse to create a "Developer-Editorial" hybrid.

*   **Display & Headlines (Space Grotesk):** Used for document titles and major section headers. The open apertures and quirky terminals of Space Grotesk provide a "high-end boutique" feel to an otherwise utilitarian app.
    *   *Scale:* Use `headline-lg` (2rem) for file names to give the workbench an editorial, "published" feel.
*   **UI & Metadata (Inter):** Used for all labels, navigation items, and code-adjacent metadata. Inter's tall x-height ensures readability at the `label-sm` (0.6875rem) level in the compact shelf cards.

---

## 4. Elevation & Depth: The Layering Principle
We reject traditional drop shadows. Elevation is conveyed through **Tonal Stepping**.

*   **Nesting Logic:** To create focus, we "step up" the brightness of the surface. 
    *   Editor background: `surface` (#0e0e0e)
    *   Floating Command Palette: `surface-container-highest` (#252626)
*   **The "Ghost Border" Fallback:** If a component (like a tooltip) risks washing into the background, use a "Ghost Border." This is the `outline-variant` (#484848) set to **15% opacity**. It should be felt, not seen.
*   **No Glass, No Gradients:** Per the creative direction, all surfaces are 100% opaque. Depth is achieved via pure color value shifts, maintaining the "Monolithic" feel.

---

## 5. Components

### Navigation Rail (Slim Left)
*   **Width:** `24` scale (5.5rem).
*   **Styling:** `surface-container-low`. 
*   **Active State:** No background change. Use a `primary` (#9fced8) 2px vertical stripe on the far left edge and a `on-surface` icon color.

### Shelf Cards (Utilitarian)
*   **Structure:** Compact blocks used in the sidebar for file lists or "blocks."
*   **Styling:** Flush edges, `0px` border-radius by default, or `sm` (0.125rem) if grouped.
*   **Spacing:** Use `3` (0.6rem) internal padding to maintain high information density.

### Top Bar (Integrated)
*   **Height:** `12` scale (2.75rem).
*   **Layout:** Integrated brand mark on the left, document breadcrumbs centered (Inter `label-md`), and mode switching (Markdown vs. Preview) on the right using flat, non-decorative tabs.

### Buttons
*   **Primary:** `primary` (#9fced8) background with `on-primary` (#14464f) text. No rounded corners—use `sm` (0.125rem).
*   **Secondary:** No background. `outline` (#767575) Ghost Border. 
*   **Tertiary/Ghost:** Flat text using `primary` color for the label, used for low-priority actions in modals.

### Input Fields & Markdown Editor
*   **Editor:** Zero chrome. The text should sit directly on the `surface` layer.
*   **Selection:** Use `primary-container` (#1c4d56) for text selection highlights to ensure the cool blue tone persists in the workflow.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetric layouts. Align the editor off-center if the shelf cards are active to create a more dynamic, "custom" feel.
*   **Do** use `surface-bright` (#2c2c2c) for hover states on list items to provide immediate, snappy feedback.
*   **Do** lean on the Spacing Scale. Use `16` (3.5rem) of padding at the top of a document to give the `headline-lg` room to breathe.

### Don't
*   **Don't** use pure black (#000000). It breaks the tonal layering logic and feels "cheap."
*   **Don't** use standard `md` or `lg` rounded corners. This system is architectural; keep corners sharp (`none`) or barely softened (`sm`).
*   **Don't** use divider lines. If two elements need separation, use a `0.2rem` gap of the `background` color or shift the `surface-container` tier.
*   **Don't** use icons for everything. Favor Inter `label-sm` text in all-caps for a more professional, technical utility feel.