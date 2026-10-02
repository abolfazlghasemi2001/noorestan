# Motion upgrade — phase 2 (2026-10-02)

## Step 1: easing + timing tokens
- New `assets/styles/motion.css`: single source for easing curves (`--ease-calm`, `--ease-light`,
  `--ease-bounce`, `--ease-smooth`, `--ease-expo-out`, `--ease-back-out`, plus the existing
  carousel `--ease-carousel` and button `--ease-press`), duration scale (`--dur-instant` → `--dur-epic`),
  stagger and movement sizes. Names do not collide with `index.html`'s own `--ease` / `--bounce`.
- Loaded via `@import` at the top of `sanctuary.css`.
- `prefers-reduced-motion` **and** `html[data-motion="off"]` collapse every duration to 1ms
  (not 0, so `transitionend`/`animationend` still fire) and zero every lift/scale.
- `sanctuary.css` touch feedback reads the tokens, each with a fallback equal to the previous value.
- The in-app motion switch now also removes the press-scale.

## Step 2: upgrade the existing Splash + Onboarding (patch, not pushed)
A standalone `splash.js` was briefly added and then removed: `index.html` already has a richer
`Splash` (mushaf art, basmala, canvas dust, gyro parallax, iris/curtain exit). It is upgraded in place.

Delivered as `motion-step2-splash-onboarding.patch` (apply with `git apply`, +100 / −21 lines,
verified to apply cleanly on main @1480ade and to pass `node --check` on the inline script).

Splash
- Full sequence only on the first load of a session (`sessionStorage['nr-splash-seen']`);
  same-session reloads get a ≤900ms version.
- Hard cap lowered from 5.2s to 3.2s.
- Lighter on small/low-core devices: 26 stars instead of 52, 22 canvas particles instead of 46.
- Progress bar fills with `transform:scaleX` (origin right for RTL) instead of `width`.
- `.sp-title` had an infinite `background-position` animation that was invisible (a later rule drops
  `background-size`) but repainted every frame; disabled.
- Stagger easings moved to `cubic-bezier(.16,1,.3,1)` (= `--ease-light`).
- `Splash.hide()`, ids and the Gate → Onboarding hand-off are unchanged.

Onboarding
- Direction-aware slide in RTL (next enters from the left, previous from the right).
- Outgoing slide fades + slides out as a decorative ghost; `paint()` stays synchronous so tests and
  `_shots` that click `#onbNext` every 320ms keep working.
- Staggered entry of art → title → text.
- Emoji art replaced by the app's own SVG icons (`mosque`, `gamepad`, `book`, `medal`) with emoji fallback;
  `art` field kept on every slide.
- Breathing glow behind the art, gentle icon float, soft "breath" on the final «شروع کن» button.
- Touch swipe (RTL: swipe right = next), ignores mouse and vertical scrolls.
- All of it off under reduced motion and `data-motion="off"`.

### Still manual
- `sw.js`: precache `./assets/styles/motion.css`, bump caches `-25` → `-26`.

## Not verified
- No browser/device run and no `_harness.js` / `_tests.js` run from here. Run both before merging.
