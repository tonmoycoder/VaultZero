# VaultZero Interaction Update

The information-rich three-pane layout and pointer-following card highlights are preserved. This update changes the interaction system, not the Rust/Tauri vault backend.

## Inspector

- `src/App.tsx` owns one selected item and one open/closed flag.
- `src/components/InspectorHost.tsx` selects a dock at 1280px and above, a right drawer at 768-1279px, and a bottom sheet below 768px. There is no hidden breakpoint gap.
- The panel supports item switching, password reveal/copy, recovery codes, an editable item form, favorite toggling, item metadata, and individual password checks.
- Closing uses an exit transition. On mobile, drag the handle downward to dismiss. Escape, backdrop dismissal, keyboard focus containment, and returning focus to the trigger are supported.
- Changing the item or leaving its details view resets revealed credentials.

## Motion

- Spring settings are shared in `src/lib/motion.ts`.
- `Tactile.tsx` uses physical springs for press/release, independent of each button's existing hover transform. Pointer-origin ripples and supported-device haptics complement the motion.
- `GlassSelection.tsx` provides a shared-layout glass indicator for navigation, themes, brand filters, inspector tabs, and security categories.
- Modal, command-palette, inspector, and toast exits finish before removal.
- OS reduced-motion changes are observed live. The in-app motion setting disables the same animation layer and is persisted as a non-sensitive preference.

## Filters And Themes

- The brand rail supports a vertical mouse wheel mapped to horizontal movement, native trackpad/touch scrolling, mouse dragging, arrow controls, and keyboard navigation. Dragging does not accidentally select a filter.
- Light and Dark retain their original direction. Zen uses espresso glass, warm amber, a muted violet sunset, subtle grain, and slow waves. Background planes crossfade without blocking input.
- The security overview has exact item counts and clickable categories. Each result opens its own inspector. The score explanation documents the calculation used by the preview.

## Verification

Run `npx tsc --noEmit`, `npx playwright test`, and `npm run build`.

The regression suite covers the previously broken laptop breakpoint, docking and resizing, mobile drag dismissal, mouse/touch/keyboard filtering, item editing, clipboard behavior, focus restoration, theme persistence, and reduced motion.

## Prototype Boundary

Vault entries in this web preview are sample data held in React state. Item edits last for the current page session; only theme, language, and interaction preferences are persisted. Native encryption, biometric authentication, OCR, TOTP provisioning, and SPAKE2 pairing are not implemented by this UI update and require the real VaultZero backend. Do not put real credentials into the prototype.
## Update 2 — Comfort, Sound And Scanning

### Layout And Contrast
- The sidebar "Add new" button had no horizontal padding, so its icon and ⌘N badge sat on the edge. It now uses a dedicated `.sidebar-add` rule with even insets, and the sidebar has a consistent 12–14px gutter.
- Dark mode secondary text was too dim. `--text-soft`, `--text-muted` and `--text-faint` were brightened, borders and surfaces strengthened, and every small label is now at least 8.5px before scaling. All three dark tokens exceed a 7:1 contrast ratio against the background.

### Text Size
- A text size control (−/Aa/+) sits in the header and in Quick access, with five steps from 90% to 135%.
- It drives a single `--font-scale` variable that every text utility multiplies, so the whole interface scales together. The preference persists.
- `--font-scale` lives on `:root` only: the themed blocks also match `.app-canvas`, which would otherwise reset the inherited value.

### Zen Soundscape
- Entering Zen mode starts a lofi soundscape synthesised live with the Web Audio API — no audio file is downloaded, so the vault stays fully offline.
- A pill with play/pause, mute and a canvas visualiser shows that sound is running. The visualiser is driven by a real `AnalyserNode`.
- One shared audio engine backs every player pill, and it is disposed as soon as Zen mode is left.

### Scan And Import
- OCR has moved out of the search field into its own "Scan & import" item in the Tools menu.
- A scan now parses the recognised text into title, username, password and website, then opens the normal add form pre-filled so everything stays editable. "Save as note" is still available.
- The add form uses standard `autocomplete` tokens (`username`, `new-password`, `url`) so browsers and password managers autofill normally, plus paste and copy buttons on the username and password fields.

### Fixes Found By The New Tests
- Copy buttons inside the add form were submitting it, because a `<button>` in a form defaults to `type="submit"`.
- A brand-new profile was pinned to the smallest text size, because `Number(null)` is `0`, a valid index.
