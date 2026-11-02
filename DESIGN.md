---
name: Dither Lab
description: A minimal dark monospace workspace for real-time dithering and GLSL experiments.
colors:
  ink: "#e6e8dd"
  muted: "#a0a69a"
  line: "#343931"
  accent: "#d3ef8d"
  background: "#171917"
  viewport: "#10120f"
  editor: "#1b1e19"
  gutter: "#191c17"
  panel: "#20231f"
  button: "#292f25"
  button-border: "#42493b"
  button-hover: "#3d4733"
  accent-ink: "#202919"
  accent-hover: "#e4f7b5"
  quiet-ink: "#bac2af"
  field: "#30362d"
  field-hover: "#394132"
  field-focus: "#3e4737"
  field-ink: "#e5eada"
  folder: "#272b25"
  folder-hover: "#30362b"
  folder-active: "#383e31"
  folder-ink: "#d6dbcd"
  field-label: "#b5bcac"
  pane-button: "#394330"
  pane-button-hover: "#48563c"
  pane-button-ink: "#e6eddc"
  groove: "#343e2b"
typography:
  wordmark:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  body:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "12px"
  code:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "11px"
    lineHeight: "19px"
  label:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "10px"
  micro:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "9px"
rounded:
  compact: "3px"
  button: "4px"
  container: "5px"
spacing:
  s4: "4px"
  s6: "6px"
  s8: "8px"
  s10: "10px"
  s12: "12px"
  s14: "14px"
  s16: "16px"
  s18: "18px"
  s20: "20px"
  s24: "24px"
components:
  button:
    backgroundColor: "{colors.button}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "8px 11px"
    typography: "{typography.body}"
  button-hover:
    backgroundColor: "{colors.button-hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.button}"
    padding: "8px 11px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-ink}"
    rounded: "{rounded.button}"
    padding: "7px"
  engine-tag:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.compact}"
    padding: "3px 5px"
    typography: "{typography.micro}"
  palette-input:
    backgroundColor: "transparent"
    rounded: "{rounded.compact}"
    width: "27px"
    height: "28px"
    padding: "0"
  shader-editor:
    backgroundColor: "{colors.editor}"
    rounded: "{rounded.container}"
---

# Design System: Dither Lab

## Overview

Dither Lab is a compact, minimal dark workspace with monospace typography throughout. Its visual character comes from near-black olive surfaces, pale text, restrained lime feedback and the pixelated image itself. Portuguese is the interface language.

The implemented workspace keeps the preview on the left, controls on the right and GLSL immediately below the preview. Density serves experimentation: small labels, grouped controls and visible code leave room for the canvas. This documents the implemented system in `src/style.css` and `src/ui.ts`; product commitments are recorded in `PRODUCT.md`.

**Key Characteristics:**
- Dark olive surfaces and pale monospace text.
- Lime for the main export action, status and focus feedback.
- Compact controls, shallow corners and fine boundaries.
- Pixelated preview with a directly editable shader beneath it.

## Colors

The palette is a low-chroma olive neutral family with one pale lime accent. Frontmatter contains the normative values; the existing CSS properties remain the implementation source.

### Primary

- **Pale lime** (`accent`): main PNG export, live status dot, engine tag, compiled status, comparison slider, caret and keyboard focus.
- **Lighter lime** (`accent-hover`): hover feedback for the primary action.
- **Dark olive ink** (`accent-ink`): text on the lime primary action.

### Neutral

- **Deep olive background** (`background`): page foundation and Tweakpane monitor background.
- **Near-black preview** (`viewport`): canvas surround.
- **Editor olive** (`editor`) and **gutter olive** (`gutter`): shader field and line-number strip.
- **Panel olive** (`panel`): right controls rail and Tweakpane base.
- **Pale ink** (`ink`) and **muted sage** (`muted`): primary content and quiet metadata.
- **Olive boundary** (`line`): structural divisions, editor outline and rail separator.
- **Button**, **button hover** and **button border**: compact secondary action surfaces.
- **Quiet ink** (`quiet-ink`): low-emphasis text actions.
- **Field**, **field hover**, **field focus**, **field ink**, **field label**, **folder**, **folder hover**, **folder active**, **folder ink**, **pane button**, **pane button hover**, **pane button ink** and **groove**: the corresponding Tweakpane custom-property roles.

## Typography

Use the system monospace stack in the frontmatter throughout, including native controls and Tweakpane. The wordmark uses weight and tight tracking; the rest of the interface relies on size, color and placement for hierarchy.

- **Wordmark:** header identity; reduces to 20px at the mobile breakpoint.
- **Title:** the controls rail heading.
- **Body:** baseline toolbar and button copy.
- **Code:** shader text and aligned line numbers; preserve the shared line height.
- **Label:** editor metadata, control-group titles and export buttons.
- **Micro:** status tags, editor tips and footer metadata. The rail pipeline note is 8px on desktop and 10px on mobile.

Use tabular numerals for canvas dimensions and time. Code remains unwrapped, with horizontal overflow and a two-space tab width.

## Layout

The desktop workspace is a two-column grid with a flexible studio and a fixed 328px controls rail, contained to 1920px. The studio has 24px side and bottom padding. A 76px header spans the application; a 66px toolbar sits above the preview. The canvas footer separates the preview from the shader editor.

The preview starts at a 3:2 ratio, has a 260px minimum height and is capped relative to viewport height. Its canvas fits inside the frame without cropping and uses pixelated rendering. The editor body is 210px high, with a 42px line-number strip. At 1600px and above, the editor body becomes 240px and the preview height cap adjusts.

At 1000px and below, the rail narrows to 300px, studio padding tightens, the header note disappears and the editor toolbar stacks. At 720px and below, the workspace becomes one column: studio first, controls afterward. The rail separator moves to its top, the header becomes 62px high, the editor body is 220px high and the preview loses its viewport height cap. Footer content stacks and export actions gain vertical padding.

Recurring spacing steps are recorded in the frontmatter. Preserve compact toolbar gaps, six-pixel palette/export gaps and the larger studio gutters. Export actions use three equal columns.

## Elevation & Depth

Most surfaces are flat. Slight tonal differences and one-pixel borders distinguish the canvas, editor, controls and control groups. Tweakpane's base shadow is explicitly transparent. A transient notice is the one elevated surface, using `0 8px 24px #0005`; it and the export progress bar are fixed near the bottom of the screen.

## Shapes

Containers have subtly curved corners using the container radius; buttons use the button radius; tags, keyboard hints and color inputs use the compact radius. The live status dot is circular. Fine solid boundaries carry structure; only the media drop target uses a dashed outline. The wordmark's checker pattern is built from a two-tone conic gradient.

## Components

### Buttons

Compact rectangular actions use an olive surface, a one-pixel border, inherited type and the button radius. Hover changes the background over 140ms. The PNG action uses lime, dark text and bold weight. Quiet actions remove the border and surface while keeping muted text. The quiet variant's hover remains transparent in the current CSS. Disabled buttons use 40% opacity and a default cursor.

Keyboard focus uses a two-pixel accent outline offset by three pixels. Respect reduced motion by removing transitions. Keyboard shortcuts appear as small outlined keycaps alongside selected actions.

### Status and engine tag

A six-pixel lime dot precedes the current effect name. The engine tag is a compact, noninteractive outlined label, with lime text and a muted olive boundary. The compiled status uses the same accent in micro type. These are status indicators rather than navigation chips.

### Tweakpane controls

Use the existing grouped folders, select fields, numeric inputs, ranges and toggles rather than introducing a second form style. Folder headings use 10px type with slight tracking; control content uses 11px. The CSS custom properties supply distinct resting, hover and focus surfaces. Control labels and related fields remain compact and aligned, with a 148px blade value width. Collapsible groups and conditional algorithm settings keep the controls rail manageable.

### Palette inputs

Native color inputs are small bordered swatches. They wrap with six-pixel gaps beneath the pane, followed by equally sized add/remove actions. Preserve descriptive Portuguese accessible labels for each swatch and both actions. Add and remove use the shared disabled treatment at the palette bounds.

### Preview

A dark, clipped frame contains the pixelated canvas. During media dragging, an inset dashed lime target overlays the preview. Dimensions, before/after range and time sit below the canvas, using muted type and tabular numerals.

### Shader editor

A bordered dark container combines a metadata/action bar, aligned gutter and code textarea, followed by a compact instructional footer. Keep code and gutter line heights identical. Focus changes the container border; the textarea intentionally omits the generic external outline. Compilation errors occupy a warm dark error strip beneath the code and wrap long messages. The editor is the page's code surface, not a decorative syntax illustration.

### Feedback

The notice uses a muted olive elevated surface with a contrasting border and pale text. The export progress bar combines a label, native progress indicator and cancel action. Both appear only when needed; statuses retain their appropriate live-region semantics.

## Do's and Don'ts

### Do:

- **Do** preserve the dark minimal monospace identity and Portuguese interface copy.
- **Do** keep the desktop canvas on the left, controls on the right and code below the canvas; stack at the implemented mobile breakpoint.
- **Do** reuse the existing lime focus, primary action and status treatments.
- **Do** preserve crisp pixel rendering, readable code alignment and labeled native controls.
- **Do** honor the reduced-motion preference.

### Don't:

- **Don't** introduce decorative display fonts or a competing control style.
- **Don't** add general-purpose card shadows to the flat workspace.
- **Don't** replace real editable code or the canvas with decorative mock content.
- **Don't** turn noninteractive status tags into navigation without a product requirement.
