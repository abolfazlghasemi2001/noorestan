# Motion upgrade — phase 2 (2026-10-02)

## Step 1: easing + timing tokens
- New `assets/styles/motion.css`: single source for easing curves (`--ease-calm`, `--ease-light`,
  `--ease-bounce`, `--ease-smooth`, `--ease-expo-out`, `--ease-back-out`, plus the existing
  carousel `--ease-carousel` and button `--ease-press`), duration scale (`--dur-instant` → `--dur-epic`),
  stagger and movement sizes.
- Loaded via `@import` at the top of `sanctuary.css`, so `index.html` is untouched in this step.
- `prefers-reduced-motion` **and** `html[data-motion="off"]` collapse every duration to 1ms
  (not 0, so `transitionend`/`animationend` still fire) and zero every lift/scale.
- `sanctuary.css` touch feedback now reads the tokens, each with a fallback equal to the previous
  hard-coded value, so behaviour is unchanged if `motion.css` fails to load.
- The in-app motion switch (`data-motion="off"`) now also removes the press-scale, which previously
  only respected the OS setting.

## Not done in this step
- `sw.js` precache / cache bump (currently `noorestan-25`). `motion.css` is served from the
  `/assets/` stale-while-revalidate branch, so it caches on first online load; the precache entry and
  bump to 26 land with the next step that edits `index.html`.
- Hard-coded easings inside `index.html` are not yet migrated (file too large to edit via the GitHub API).
- No browser/device run, no `_harness.js` run. Needs `node _harness.js` + a visual check before merge.
