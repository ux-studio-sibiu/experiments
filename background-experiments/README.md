# Background Experiments - SVG Patterns

A playground for exploring SVG background patterns with CSS effects, inspired by the randomize-studio utility. Mix and match scalable vector patterns, adjust opacity and scale, apply color tints, and experiment with blend modes.

## Structure

Following the same pattern as **randomize-studio**:

- **`index.html`** — Main page with stage (preview) and control panel
- **`patterns.js`** — SVG pattern catalog and loader (similar to `fonts.js`)
- **`script.js`** — Application state management and UI bindings
- **`style.css`** — Styling for stage and panel
- **`patterns/`** — 90+ SVG pattern files

## How to Use

1. Open `index.html` in a browser (or serve locally with a dev server)
2. The preview stage shows your current pattern combination
3. Use the panel to:
   - Select a pattern from the dropdown
   - Adjust scale, opacity, rotation
   - Choose a tint color
   - Select blend mode (multiply, screen, overlay, etc.)
   - Add a second pattern layer
   - Adjust background color and scrim
4. Click **⤨ Randomize** to generate random combinations
5. Lock 🔒 sections to keep them while randomizing the rest
6. Press **R** to randomize (quick shortcut)
7. Copy the CSS when you find a combination you like

## Key Features

### Pattern Parameters
- **Scale**: 0.5–10× (affects pattern repeat size)
- **Opacity**: 0–1 (transparency of the pattern)
- **Color**: Any hex color (tints the pattern)
- **Blend mode**: multiply, screen, overlay, color-dodge, color-burn, lighten, darken, normal
- **Rotation**: 0–360° in 15° increments

### Dual Patterns
- Add a second pattern layer for complex effects
- Each layer has independent scale, opacity, color, and blend mode
- Toggle on/off without losing settings

### Layout Controls
- Content width (380–1500px)
- Text color and card background
- Card opacity and padding
- Vertical and horizontal alignment
- Scrim overlay (dark/light, 0–85% opacity)

### Randomization
- Click dice icons to randomize specific sections
- Click **Randomize** for full random combo
- Lock sections to keep while randomizing others
- Press **R** for quick randomization

## File Format

Each pattern is a simple SVG with `fill="#000"` (black):

```xml
<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
  <g fill="#000" fill-rule="evenodd">
    <!-- shapes here -->
  </g>
</svg>
```

The app automatically:
- Loads the SVG as a data URL
- Recolors `#000` to the selected color
- Applies as a repeating background
- Applies scale, opacity, blend mode, and rotation via CSS

## Implementation Notes

- **Lightweight**: Patterns are loaded on-demand and cached in `patternCache`
- **Color tinting**: SVG recoloring happens via string replacement (simple but effective)
- **Pattern 2**: Currently uses CSS background layering; could be extended to composite patterns in a canvas
- **State-driven**: All UI updates flow from a single `state` object
- **Keyboard shortcuts**: Press **R** to randomize (disabled while editing text)

## Layout

- **Stage** (left): Full-screen preview with pattern, background, and content
- **Panel** (right): Collapsible control panel with all parameters
- **Mobile**: Panel slides in/out to save space on narrow screens

## Next Steps / Ideas

- Export patterns as CSS classes for use in projects
- Add pattern library search/filter
- Create custom patterns from uploaded SVGs
- Add preset combinations
- Generate pattern variations by adjusting viewBox/scale dynamically
- Add SVG mask support for advanced overlay effects
