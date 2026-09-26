# Motion upgrade — phase 1 (2026-09-26)

## Implemented
- Retained the dependency-free native carousel (no Swiper/CDN dependency).
- 800ms cubic-bezier depth/slide transitions; adjacent panels sit at -40px depth.
  Inactive panels remain hidden/inert rather than showing overlapping readable copy.
- Active image parallax. No animated blur, shadow, dimensions or positioning.
- Five-second autoplay; existing hover/focus/user/hidden-tab/home-screen pause gates retained.
- Touch does not activate a sticky simulated hover pause.
- Drag velocity settles to adjacent slide; stale velocity (>100ms) cannot trigger a flick.
- Clear drag styles on reversal, cancellation, snapback and committed navigation.
- Reduced-motion swipe now releases properly; spatial animation disabled for OS and app settings.
- Pointer capture starts only after horizontal intent, preserving taps and vertical scrolling.
- Cancel on lost capture/window blur. `will-change` only during drag; panel layout containment.

## Checks
- `node _check-scripts.js`: pass.
- `node _harness.js`: 764 passed, 0 failed (45 preserved regression sections).
  Existing autoplay assertion updated from 4500ms to the requested 5000ms.
- `node _carousel-motion-tests.js`: pass. Real controller in a small DOM fixture:
  cadence, flick, reversal, cancellation, reduced-motion swipe, vertical scroll,
  negative wrap, inert panels, window blur, hover and background pause.
- `git diff --check`: pass.

## Evidence / limitations
Browser automation installation succeeded, but Chromium cannot launch because
`libnspr4.so` is absent. Both HTTP and HTTPS attempts to fetch OS packages failed.
No before/after screenshots or two-second GIF were produced. No actual Android
Chrome / iOS Safari, 360px rendering, performance trace or sustained 60 FPS claim.
Behavioral fixture tests are not a substitute for those device/visual checks.
The original guarded one-time listener registration is retained; no new recurring
animation loop or per-navigation listener registration was added. Heap profiling
has not been performed.

Phases 2–7 remain pending; this is a phase-1 checkpoint, not final acceptance.
No push performed.
