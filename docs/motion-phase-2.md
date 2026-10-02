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

## Step 2: splash
- New `assets/motion/splash.js` (self-contained, injects its own markup) + splash styles in `motion.css`.
- Sequence: backdrop fade → lantern-arch mark scales in with glow → 12 orbiting gold particles
  (staggered) → «نورستان» rises in → shimmer sweep → fade + 1.03 scale out.
- Min 1.3s, max 2.4s (+0.45s exit). Tap / key / tab-hidden dismisses immediately.
- Shown once per session (`sessionStorage['nr-splash-seen']`).
- Never built under `prefers-reduced-motion`, `data-motion="off"`, `navigator.webdriver`
  (keeps `_shots*.js` / automation clean) or `?nosplash`.
- Animates transform + opacity only; one infinite CSS rotation that is removed with the node; no rAF loop.
- Dispatches `window` event `nr:splash-done` for later onboarding/hero choreography.

### Manual integration (index.html is too large to edit via the GitHub API)
1. `index.html`, immediately after the opening `<body ...>` tag:
   `<script src="./assets/motion/splash.js"></script>` (synchronous on purpose, to cover first paint).
2. `sw.js`: add `'./assets/styles/motion.css'` and `'./assets/motion/splash.js'` to `PRECACHE`,
   bump the four cache names from `-25` to `-26`.

## Not verified
- No browser/device run, no `_harness.js` run. Needs `node _harness.js` + an Incognito check
  (with and without OS reduced-motion) before merging to `main`.
