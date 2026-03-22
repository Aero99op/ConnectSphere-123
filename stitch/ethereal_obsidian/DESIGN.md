# Design System Specification: Ethereal Obsidian

## 1. Overview & Creative North Star
**Creative North Star: The Neon Nocturne**

This design system is a masterclass in "Ethereal Obsidian"—a visual language that balances the weight of deep, infinite voids with the weightlessness of light-emitting glass. We are moving away from the "flat app" trend toward a high-fidelity, futuristic editorial experience. By utilizing intentional asymmetry, overlapping frosted layers, and light as a functional material, we create a UI that feels less like a series of buttons and more like a sophisticated digital cockpit. 

The aesthetic is driven by depth. We challenge the rigid grid by allowing neon accents to "bleed" across boundaries, using light to guide the eye rather than structural lines. This is where high-fashion editorial meets aerospace HUDs.

---

## 2. Colors
Our palette is designed to function in low-light environments, prioritizing chromatic depth over flat fills.

### Core Palette (Material Token Mapping)
*   **Background (Deep Navy):** `surface: #0c0e12` (The infinite canvas).
*   **Primary (Electric Violet):** `primary: #ba9eff` | `primary_dim: #8455ef` (The soul of the brand).
*   **Secondary (Cyber Cyan):** `secondary: #53ddfc` (Action and interactive states).
*   **Accents (Neon Pink):** `tertiary: #ff86c3` (Critical highlights and notifications).

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. We define space through **Tonal Shifts**. To separate a sidebar from a main feed, transition from `surface` to `surface_container_low`. If a section needs to stand out, use a soft background fill shift rather than a stroke.

### Surface Hierarchy & Nesting
Think in layers of glass.
1.  **Base Layer:** `surface` (#0c0e12)
2.  **Inset/Low Importance:** `surface_container_low`
3.  **Standard Cards:** `surface_container`
4.  **Floating Elements:** `surface_container_highest` + Glassmorphism.

### The "Glass & Gradient" Rule
Floating UI (Modals, Hover states, Quick Actions) must use:
*   **Fill:** `white/5` to `white/10` over a `backdrop-blur-xl`.
*   **Signature Texture:** Subtle linear gradients (e.g., `primary` to `primary_dim` at 15 degrees) on CTAs to provide a sense of "glow" from within the component.

---

## 3. Typography
The type system creates a high-contrast editorial rhythm.

*   **Display & Headlines (Outfit):** Use **Bold** weight with tight tracking (-2% to -4%). This creates a "monolithic" and authoritative feel. `display-lg` (3.5rem) should be used sparingly to anchor large hero sections.
*   **Body & Labels (Inter):** Focused on ultra-high legibility. Inter’s neutral character balances the aggressive personality of Outfit.
*   **Visual Hierarchy:** Large, tight headlines (`headline-lg`) paired with generous white space and `body-md` text creates the "Editorial" feel. Do not fear large gaps; white space is a premium asset in this system.

---

## 4. Elevation & Depth
Depth is not a shadow; it is a physical state.

### The Layering Principle
Achieve lift by "stacking" container tiers. A `surface_container_highest` card placed on a `surface` background creates a natural, soft lift.

### Ambient Shadows & Light Leaks
When an element must "float" (like a primary action button or a modal):
*   **Shadow:** Use a multi-layered glow. Instead of a grey shadow, use a tinted shadow based on the primary color: `rgba(139, 92, 246, 0.15)` with a `40px` blur.
*   **The "Ghost Border" Fallback:** If accessibility requires a container edge, use `outline_variant` at **10% opacity**. It should be felt, not seen.

### Glassmorphism Specs
All glass elements require:
*   `backdrop-filter: blur(24px);`
*   `background: rgba(255, 255, 255, 0.03);`
*   `border: 1px solid rgba(255, 255, 255, 0.1);` (The "Ethereal Edge").

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_dim`). `round: full`. Multi-layered violet glow on hover.
*   **Secondary:** Glass-morphic base with `secondary` (Cyber Cyan) text.
*   **Tertiary:** Ghost style. No background, `on_surface` text with `primary` icon.

### Cards & Lists
*   **Rule:** No dividers. Use `spacing: 6` (2rem) to separate list items or subtle background shifts using `surface_container_low`.
*   **Interactive Cards:** On hover, the border should shift from `white/10` to `primary/40` and the backdrop blur should intensify.

### Input Fields
*   **Base:** `surface_container_highest` fill.
*   **State:** On focus, the bottom edge gains a `secondary` (Cyber Cyan) neon "underline" glow, but no full-box stroke.

### Signature Component: The "Obsidian Orb"
A decorative or functional element (like a profile trigger or notification hub) that uses a heavy `backdrop-blur`, a `primary` glow, and `xl` roundedness to mimic a physical lens.

---

## 6. Do's and Don'ts

### Do
*   **DO** use asymmetric layouts. Align text to the left but allow imagery or glass cards to bleed off-grid.
*   **DO** use neon accents (`tertiary` Pink) for micro-interactions, like a tiny 4px dot for unread notifications.
*   **DO** prioritize high-contrast typography. If the headline is large, make the body text significantly smaller but with generous line-height (1.6+).

### Don't
*   **DON'T** use 100% opaque borders. They break the "Ethereal" illusion.
*   **DON'T** use pure black (#000000) for backgrounds. Use the `surface` token (#0c0e12) to maintain depth and color-grade the shadows.
*   **DON'T** use standard "drop shadows." If it doesn't look like a soft neon glow or a natural ambient occlusion, it's too "standard" for this system.
*   **DON'T** clutter the UI. This system relies on the "Luxury of Space." If a screen feels busy, increase the spacing tokens (use `spacing: 8` or `12`).