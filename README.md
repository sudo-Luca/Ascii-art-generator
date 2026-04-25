# ASCII.GEN — Image to Text Converter

> **v2.1** — Convert any image to ASCII art, entirely in the browser, with no external dependencies or server required.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [File Structure](#file-structure)
4. [Features](#features)
   - [Rendering Modes](#rendering-modes)
   - [Monospace Fonts](#monospace-fonts)
   - [Character Sets](#character-sets)
   - [Options](#options)
   - [Export](#export)
5. [Technical Architecture](#technical-architecture)
   - [Generation Pipeline](#generation-pipeline)
   - [Edge Detection Mode (detail)](#edge-detection-mode-detail)
   - [Braille Mode (detail)](#braille-mode-detail)
   - [Color Rendering](#color-rendering)
6. [Installation & Usage](#installation--usage)
7. [Interface](#interface)
   - [Desktop](#desktop)
   - [Mobile](#mobile)
8. [Customization](#customization)
9. [Browser Compatibility](#browser-compatibility)
10. [Known Limitations](#known-limitations)

---

## Overview

**ASCII.GEN** is a static web application that converts any image into ASCII art. It runs entirely client-side using the HTML5 Canvas API — no data is ever sent to a server.

**Tech stack:** HTML5 · CSS3 (CSS variables, Grid, Flexbox) · Vanilla JavaScript (ES6+) · Canvas API · Google Fonts (external load for fonts only).

---

## Quick Start

```
1. Open ascii-art-generator.html in a modern browser
2. Drag and drop an image into the drop zone (or click to browse)
3. Adjust parameters in the sidebar
4. Click "Générer →"
5. Copy or export the result
```

---

## File Structure

```
ascii-art-generator.html   # HTML structure, layout, UI components
style.css                  # Dark theme, design system, mobile responsive
script.js                  # Conversion logic, ASCII generators, export
```

No npm dependencies, no bundler required. All three files must be in the same directory.

---

## Features

### Rendering Modes

| Mode | Description | Characters used |
|------|-------------|-----------------|
| **Classic Lum.** | Maps each pixel's luminance to a character from the selected set | Configurable charset |
| **Edge Detect.** | Detects edges via Sobel filter (with prior Gaussian blur) and traces their direction | `- \ | /` |
| **Block Shade** | Uses Unicode block-fill characters for smooth gradation | `░ ▒ ▓ █` |
| **Braille Dots** | Encodes 8 pixels per braille character (Unicode U+2800–U+28FF) | Braille blocks |

### Monospace Fonts

9 Google Fonts available, selectable from the sidebar:

- Space Mono *(default)*
- JetBrains Mono
- Fira Code
- IBM Plex Mono
- Source Code Pro
- Inconsolata
- Roboto Mono
- Courier Prime
- Share Tech Mono

Font changes apply instantly to the display and are taken into account during SVG/PNG export.

### Character Sets

Available in **Classic** mode only (disabled for other modes):

| Name | Characters | Recommended use |
|------|-----------|-----------------|
| **Standard** | ` .,:;*?%S#@` | General purpose |
| **Dense** | ` .:-=+*#%@$` | High-contrast images |
| **Simple** | ` ░▒▓█` | Soft block rendering |
| **Binary** | ` 1` | Bitmap / pixelated effect |
| **Letters** | ` .=+oXHABMW` | Typographic style |

### Options

| Option | Default | Effect |
|--------|---------|--------|
| **Invert** | OFF | Reverses the luminance→character mapping (negative image) |
| **Color (ANSI)** | OFF | Colors each character with the source pixel's RGB value (via inline `<span>`) |
| **High Contrast** | OFF | Amplifies dark and bright areas: `lum < 0.5` → attenuated, `lum ≥ 0.5` → amplified |
| **Keep Ratio** | ON | Computes output height from the source image aspect ratio (with ×0.5 correction for character proportions) |

**Resolution:**
- **Width**: 20 to 300 character columns (default: 100)
- **Font px**: 4 to 16 px for display (default: 6) — also adjustable with the `−` / `+` buttons in the toolbar

### Export

| Format | Details |
|--------|---------|
| **Copy** | Copies raw ASCII text to the clipboard (Clipboard API) |
| **.txt** | Downloads raw ASCII text as UTF-8 |
| **.svg** | Generates a vector SVG with `#080808` background, `<text>` elements per line, using the current font and size |
| **.png** | Rasterizes via an off-DOM `<canvas>` (×2 resolution for sharpness), downloads as PNG |

---

## Technical Architecture

### Generation Pipeline

```
Source image (File / DataURL)
        │
        ▼
   loadImage()
   ┌─────────────────────────────┐
   │  FileReader → HTML Image    │
   │  Preview shown in uploadZone│
   └─────────────────────────────┘
        │  click Generate
        ▼
   generate()
   ┌─────────────────────────────────────────────┐
   │  Compute dimensions sw × sh                 │
   │  (ratio corrected ×0.5 for non-square chars)│
   │  Draw onto <canvas id="source-canvas">      │
   │  Extract getImageData() → Uint8ClampedArray │
   └─────────────────────────────────────────────┘
        │
        ├─── mode = classic  → generateClassicASCII()
        ├─── mode = edge     → generateEdgeASCII()
        ├─── mode = block    → generateBlockASCII()
        └─── mode = braille  → generateBrailleASCII()
                │
                ▼
         { text, colorData }
                │
                ▼
         renderOutput()
         updateInfo()
```

### Edge Detection Mode (detail)

The algorithm operates in 5 steps on a **double-height pixel grid** (to compensate for glyph aspect ratio):

1. **Grayscale** — perceptual luminance: `0.299·R + 0.587·G + 0.114·B`
2. **5×5 Gaussian blur** — normalized kernel (sum = 159) to reduce noise before Sobel
3. **Sobel filter** — computes Gx and Gy gradients, magnitude `Gm` and angle `G`
4. **Simplified Canny thresholding** — non-maximum suppression + hysteresis (low/high thresholds)
5. **Angular quantization** — edge direction (0–179°) is mapped to `- \ | /`

Each output character covers 1×2 pixels of the internal grid.

### Braille Mode (detail)

A braille character (U+2800–U+28FF) encodes a 2×4 pixel grid:

```
Bit layout:   Position in block:
  0  3          col 0, row 0  |  col 1, row 0
  1  4          col 0, row 1  |  col 1, row 1
  2  5          col 0, row 2  |  col 1, row 2
  6  7          col 0, row 3  |  col 1, row 3
```

The resulting codepoint is `0x2800 | bitmask`. The image is resampled to `width×2` × `height×4` before computation.

### Color Rendering

When the "Color" option is enabled, `generateClassicASCII()` builds a parallel `colorData[]` array containing `rgb(r,g,b)` for each character. `renderOutput()` then creates one `<span>` per character with the corresponding `style.color` (instead of a plain `pre.textContent`).

> ⚠️ This option may slow down rendering at large resolutions (>150 columns) as it generates thousands of DOM elements.

---

## Installation & Usage

### Local usage (no server)

```bash
# Clone or download the 3 files into a folder
git clone https://github.com/sudo-Luca/Ascii-art-generator.git
cd ascii-gen

# Open directly in the browser
open ascii-art-generator.html
# or
xdg-open ascii-art-generator.html  # Linux
```

> The Clipboard API (`navigator.clipboard`) requires a secure context (HTTPS or `localhost`). Copying will not work over `file://` in some browsers. All other features (generation, export) work without a server.

### With a minimal local server

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# Then open http://localhost:8080/ascii-art-generator.html
```

---

## Interface

### Desktop

```
┌─────────────────────────────────────────────────────────────┐
│  ASCII.GEN          Image to Text Converter             v2.1│
├─────────────────────┬───────────────────────────────────────┤
│  SIDEBAR (300px)    │  OUTPUT AREA                          │
│                     │  ┌─ Toolbar ─────────────────────────┐│
│  ┌ Source ──────┐   │  │ ◈ Copy │ ↓.txt │ ↓.svg │ ↓.png   ││
│  │ Drop zone    │   │  │ − + │ 120×60 — classic — Space Mo ││
│  └──────────────┘   │  └───────────────────────────────────┘│
│  ┌ Resolution ──┐   │                                       │
│  │ Width ████░  │   │  ██████████████████████████           │
│  │ Font px ██░  │   │  ████ ASCII ART OUTPUT ████           │
│  └──────────────┘   │  ██████████████████████████           │
│  ┌ Mode ────────┐   │                                       │
│  │Classic│Edge  │   │                                       │
│  │Block  │Brail │   │                                       │
│  └──────────────┘   │                                       │
│  ┌ Font ────────┐   │                                       │
│  │ ...          │   │                                       │
│  └──────────────┘   │                                       │
│  ┌ Charset ─────┐   │                                       │
│  │ ...          │   │                                       │
│  └──────────────┘   │                                       │
│  ┌ Options ─────┐   │                                       │
│  │ Invert    ○  │   │                                       │
│  │ Color     ○  │   │                                       │
│  │ Contrast  ○  │   │                                       │
│  │ Ratio     ●  │   │                                       │
│  └──────────────┘   │                                       │
│  [ Generate → ]     │                                       │
└─────────────────────┴───────────────────────────────────────┘
```

The sidebar is sticky and scrollable independently from the output area.

### Mobile (≤ 768px)

The sidebar is hidden and becomes a full-screen overlay triggered by the **⊟ Settings** button at the bottom of the screen. A fixed bottom bar also exposes the **Generate →** button. After generation, the sidebar closes automatically.

---

## Customization

### Changing the color theme

All colors are CSS variables in `:root` inside `style.css`:

```css
:root {
  --bg: #080808;        /* Main background */
  --bg2: #0f0f0f;       /* Sidebar background */
  --bg3: #161616;       /* UI element background */
  --accent: #e8ff47;    /* Fluorescent yellow (buttons, highlights) */
  --accent2: #47ffe8;   /* Cyan (active font, charset) */
  --text: #f0f0e8;      /* Primary text */
  --muted: #666;        /* Secondary text */
}
```

### Adding a character set

In `script.js`, extend the `CHARSETS` object:

```js
const CHARSETS = {
  // ... existing sets
  myCharset: ' .oO0@'  // From lightest to darkest
};
```

Then add the corresponding button in the HTML (`#charset-section`).

### Changing the resolution range

Update the `min`, `max`, and `value` attributes of the `#width-slider` in the HTML:

```html
<input type="range" id="width-slider" min="20" max="500" value="120" step="1">
```

---

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome / Edge 90+ | ✅ Full |
| Firefox 90+ | ✅ Full |
| Safari 15+ | ✅ Full |
| Chrome Android | ✅ Full (mobile UI) |
| Safari iOS 15+ | ✅ Full (mobile UI) |
| IE 11 | ❌ Not supported |

Required features: `Canvas API`, `FileReader`, `Clipboard API` (copy only), `Unicode BMP + SMP` (braille), `CSS Custom Properties`, `CSS Grid`.

---

## Known Limitations

- **SVG/PNG export**: Google Fonts are not embedded in exports. Rendering depends on fonts installed on the target machine.
- **Color mode**: creates one DOM node per character — slow beyond ~150 columns.
- **Braille on mobile**: display depends on system Unicode support (may render incorrectly on iOS < 15).
- **Edge mode**: performance may degrade on very high-resolution inputs (>200 columns) due to the 5×5 Gaussian filter and Sobel computed in pure JS.
- **Clipboard API**: unavailable over the `file://` protocol — use a local server for the copy feature.