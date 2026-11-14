---
name: Warm Tech Assessment
colors:
  surface: '#FAF7F0'
  surface-dim: '#dcd9d9'
  surface-bright: '#FAF7F0'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#252525'
  on-surface-variant: '#77736E'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#8b7269'
  outline-variant: '#dec0b6'
  surface-tint: '#a43d0d'
  primary: '#a43d0d'
  on-primary: '#ffffff'
  primary-container: '#f47745'
  on-primary-container: '#5f1d00'
  inverse-primary: '#ffb59a'
  secondary: '#8f4d22'
  on-secondary: '#ffffff'
  secondary-container: '#F6A16F'
  on-secondary-container: '#773a10'
  tertiary: '#7b5800'
  on-tertiary: '#ffffff'
  tertiary-container: '#c0943a'
  on-tertiary-container: '#442f00'
  error: '#D96C61'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#ffb59a'
  on-primary-fixed: '#380d00'
  on-primary-fixed-variant: '#802a00'
  secondary-fixed: '#ffdbc9'
  secondary-fixed-dim: '#ffb68d'
  on-secondary-fixed: '#331200'
  on-secondary-fixed-variant: '#72360c'
  tertiary-fixed: '#ffdea5'
  tertiary-fixed-dim: '#f0bf60'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#FAF7F0'
  on-background: '#252525'
  surface-variant: '#e4e2e1'
  success: '#6B9B78'
  warning: '#E9B95B'
  border-subtle: '#E9E4DB'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-code-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
  label-code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  label-ui:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  DEFAULT: 0.25rem
  lg: 0.5rem
  xl: 1rem
  2xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system models high-stakes technical assessments through an approachable, human-centered lens. Designed for ambitious candidates and university students preparing for technical interviews, the aesthetic counters performance anxiety by replacing sterile corporate blues and clinical monochrome terminal palettes with a warm, energetic, and tactile visual landscape.

The design movement blends **Warm Modernism** with purposeful tactile UI precision:
- **Calm, High-Readability Workspace:** Deep charcoal typography rested against ivory and alabaster substrates to minimize optical fatigue over multi-hour coding sessions.
- **Empowering Momentum:** Vibrant coral orange drivers that frame progression, milestone completion, and interactive state triggers without screaming crisis or alarm.
- **Non-Distracting Technical Rigor:** IDE spaces, execution telemetry, and split panes retain high-contrast precision while adhering strictly to warm-spectrum ambient lighting.
- **Absolute Exclusion:** The entire experience is strictly devoid of cold spectrums (zero blue, navy, indigo, cyan, or teal).

## Colors

The palette establishes an organic, focused equilibrium. Contrast ratios meet strict WCAG AAA standards on core surfaces while completely eliminating all blue wavelengths.

### Color Tokens & Assignments
- **Canvas Base (`bg-canvas`):** `#FAF7F0` (Warm Cream). The foundational background for global viewports, assessment lobbies, and surrounding chrome.
- **Surface Elevation (`bg-surface`):** `#FFFFFF` (Pure White). Reserved for question briefs, test suite matrices, card containers, and modal sheets.
- **Dark Surface (`bg-editor`):** `#1C1A18` base with `#23201D` for code gutter and active line surfaces. Engineered for technical focus and long-form Python editing.
- **Primary Interactive & Key CTA (`accent-primary`):** `#F47745` (Vibrant Coral Orange). Drives run actions, submission pathways, primary tab highlights, and active step meters.
- **Secondary Accent (`accent-secondary`):** `#F6A16F` (Soft Orange). Used for hover states, progress tracking fills, warm focus rings, and secondary statistics.
- **Typography Primary (`text-primary`):** `#252525` (Deep Charcoal). Maximum contrast on ivory/white surfaces without harsh optical black glare.
- **Typography Muted (`text-secondary`):** `#77736E` (Warm Grey). Applied to metadata, sub-labels, line counts, and secondary indicators.
- **Border & Separation (`border-subtle`):** `#E9E4DB` (Light Warm Grey). Clean, tactile separation for cards, split-pane dividers, and input borders.

### Functional States
- **Success:** `#6B9B78` (Muted Sage Green). Used for passing test cases, "Accepted" verdict chips, and run success telemetry.
- **Warning:** `#E9B95B` (Warm Amber Yellow). For performance throttles, partial points, time alerts, and non-fatal runtime warnings.
- **Error:** `#D96C61` (Soft Coral Red). For syntax faults, runtime exceptions, and failed assertions.

## Typography

The typographic hierarchy establishes clear structural distinction across documentation, prompt parsing, and code editing:

- **Headings (Plus Jakarta Sans):** Geometric, warm, and confident. Heavy weights (700/800) create assertive entry points for problem titles, test summaries, and module headings.
- **Problem Descriptions & Body (Inter):** Highly legible, neutral workhorse. Calibrated with generous line-heights (1.6x) to facilitate reading complex problem constraints, edge cases, and algorithm examples without cognitive strain.
- **Code & Test Suite Telemetry (JetBrains Mono):** Crisp code rendering optimized for Python syntax highlighting, benchmark outputs, test cases, and memory/runtime statistics.
- **Numbers & Metrics:** Tabular figures (`tnum`) enabled across timers, score tickers, and test count chips.

## Layout & Spacing

The layout model optimizes space utilization for IDE panels while maintaining structured white space in dashboard contexts.

### Multi-Pane Architecture
1. **Split-Pane Assessment Mode:**
   - **Left Pane (40%-50% flex width):** Problem description, examples, constraints, and custom test input.
   - **Right Pane (50%-60% flex width):** Code editor header (language selector, layout toggles), dark editor workspace, and collapsable bottom console (execution results, test outputs).
   - **Divider Handle:** A 4px warm hover hit-area with an active coral bar `#F47745` for fluid user resizing.
2. **Dashboard & Configuration Mode:**
   - 12-column grid capped at `1440px` maximum viewport width.
   - 24px outer section margins on desktop, collapsing to 16px on mobile.

### Responsive Breakpoints
- **Mobile (< 768px):** Stacks code view and problem context into an anchored swipeable tab architecture. Gutters downscale to 8px inside the console.
- **Tablet (768px - 1024px):** Vertically stacked layout (top: problem context, bottom: editor) or tight 50/50 horizontal split.
- **Desktop (> 1024px):** Persistent dual-pane side-by-side execution view with fixed top assessment ribbon.

## Elevation & Depth

This design system avoids dark generic shadows or cool-tinted drops. Elevation is communicated through warm tonal layering and soft warm-charcoal diffused occlusion.

### Elevation Hierarchy
- **Level 0 (Flat Ground):** `#FAF7F0` canvas layer. No shadow.
- **Level 1 (Cards & Work Panels):** `#FFFFFF` surfaces bounded by a crisp 1px `#E9E4DB` border and backed by an ultra-diffuse warm shadow: `0px 4px 16px rgba(37, 37, 37, 0.04)`.
- **Level 2 (Hovered Cards & Interactive Controls):** Elevated with `0px 8px 24px rgba(37, 37, 37, 0.07)`, 1px border shifting to `#D7CFBE`.
- **Level 3 (Floating Controls, Timer Badges, Dropdowns):** `0px 12px 32px rgba(37, 37, 37, 0.09)`.
- **Dark Workspace Contrast:** The `#1C1A18` coding panel uses internal recessed edges (`inset 0 1px 2px rgba(0, 0, 0, 0.35)`) and a subtle `#2F2B27` border to anchor itself against the bright canvas.

## Shapes

The interface embraces a unified, inviting curve profile:

- **Core Cards & Panels:** Styled with 14px to 16px border-radii (`rounded-lg`), producing friendly, tactile containers for questions, run panels, and test cases.
- **Interactive Controls (Buttons, Inputs, Selectors):** Normalized at 8px to 10px (`rounded-md`), pairing geometric precision with soft touch targets.
- **Badges, Tags, and Pill Meters:** Fully rounded (`rounded-full`, 9999px) to signal micro-status contexts without competing with structural content blocks.
- **Code Terminal & Console Frame:** Constrained to 12px corner radii to balance dense line numbers and monospaced code grids cleanly.

## Components

### Buttons
- **Primary ("Run Code", "Submit Assessment"):** Solid `#F47745` background, `#FFFFFF` bold text, zero border. Hover shifts to `#E06332` with an ambient warm shadow (`0 4px 12px rgba(244, 119, 69, 0.28)`).
- **Secondary ("Run Custom Tests", "Reset Code"):** Warm ivory `#FAF7F0` background with a 1px `#E9E4DB` border and `#252525` text. Hover transitions to `#FFFFFF` with border `#D7CFBE`.
- **Destructive ("Abandon Test"):** Warm red-tinted outline with `#D96C61` text and hover fill `rgba(217, 108, 97, 0.08)`.

### Status Badges & Pills
- **Ready:** Border and text `#77736E`, background `rgba(119, 115, 110, 0.1)`.
- **Active / Running:** Coral orange `#F47745` text, background `rgba(244, 119, 69, 0.12)`, punctuated by an animated pulsing coral indicator dot.
- **Finished / Accepted:** Muted green `#6B9B78` text, background `rgba(107, 155, 120, 0.12)`, paired with a check icon.
- **Compile / Test Error:** Soft coral red `#D96C61` text, background `rgba(217, 108, 97, 0.12)`.

### Input Fields & Selectors
- **Text Inputs & Dropdowns:** 44px height, background `#FFFFFF`, border 1px solid `#E9E4DB`, text `#252525`. 
- **Active Focus:** Focus ring composed of a warm glowing boundary: `0 0 0 3px rgba(244, 119, 69, 0.2)` with a `#F47745` border. Absolutely no blue focus rings.

### Progress Trackers & Countdown Timer
- **Progress Track:** 8px height, rounded pill shape, background `#E9E4DB`.
- **Progress Indicator:** Gradient fill transitioning from `#F6A16F` into `#F47745`.
- **Countdown Module:** Fixed floating badge, background `#FFFFFF`, border `#E9E4DB`, featuring monospaced numerals in `#252525`. Shifts to `#D96C61` amber/red treatment when under 5 minutes remaining.

### Code Editor & Terminal Pane
- **Background:** `#1C1A18` deep warm charcoal.
- **Gutter & Line Numbers:** Text `#77736E`, gutter line border `#2C2824`. Active line highlight `#2A2622`.
- **Console Tabs ("Test Result", "Console Output", "Custom TestCase"):** Inactive items have `#77736E` text; active item displays `#FAF7F0` text anchored with an active 2px bottom underline in `#F47745`.
## Corner scale (Tailwind names)

`rounded` 4px for small chips; `rounded-lg` 8px for buttons, inputs and selectors; `rounded-xl` 16px for cards and panels; `rounded-2xl` 24px for large feature cards; `rounded-full` for badges, pills and avatars. The front matter above and the screen files use these same values.

## Decisions (recorded 2026-11-11)

1. **This file is the design authority.** When a screen file disagrees with it, the screen file is wrong.
2. **Remove every feature the backend does not support.** No dead buttons, no invented numbers. Anything wanted later goes on a future-features list, never on screen.
3. **Unopened questions show only `Q{n} · Topic · Difficulty`.** The title loads only when the student opens the question (E12 starts that question's clock).
4. **Product limits live in one frontend file** (`src/config/limits.js`) with the same values as the backend. `.env` holds only the API URL and other settings.
5. **Round rows are labelled by date, duration and topics, never by round ID.**
6. **Start always passes through Ready round details.** Dashboard and My Rounds link there; the clock begins only from that page.
7. **The report time bar is one row per question, with minute marks,** built from `timeMap`.
8. **Each insight rule has a fixed tone** (warning or good news) decided by the rule, not the wording. There are no grade subtitles; the API's insight text is shown as is.
9. **No "Performance" menu item.** Reports are per round and are reached from My Rounds.
10. **Avatars show the user's initials and the logo is the terminal icon plus "OA Simulator".** No remote images.
11. **Success green `#6B9B78` marks Solved, Accepted, Finished and passed tests.** Gold marks Ready and Medium.

## Known gaps in the screen files

The HTML files are layout references and still show some features that decision 2 removes (for example Forgot password, language list, search and sort, percentiles, the PRO PLAN card, round IDs, the Performance menu item). The `screen.png` files predate the colour, corner and border fixes. Build from the HTML and this document, not from the PNGs.
