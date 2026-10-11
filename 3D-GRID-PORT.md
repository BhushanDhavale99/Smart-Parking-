# Parking grid port

The TanStack Start base remains the application. Only the parking map interaction was ported from the supplied Bolt reference; no reference app, router, auth, booking, checkout, or page implementation was imported.

## Changes

- Added stable zero-based row/col positions: each floor has rows A, B, EV and four columns. All 36 original records retain their original IDs, status, floor, type, zone and price.
- ParkingMap now renders ParkingGrid3D and keeps its existing floor/zone controls, selection state and onSelection callback. Preview retains its existing ten-slot limit.
- Added bounded drag rotation, zoom/reset and keyboard/touch rotation controls. Drag gestures suppress selection; unavailable bays expose details but reject selection.
- Adapted MapEffects, useReducedMotion and useVisible only. Fixed the reference hook for server rendering and React 19 refs. No duplicate page-level effects were added.
- Used existing semantic palette tokens and restrained platform/bay shadows. New CSS is scoped under pg3d; no global animation rules or Radix/shadcn keyframes were changed.
- Added framer-motion, an npm lockfile, and a typecheck script. Use npm ci for the updated dependency set; the original Bun lockfile is unchanged.

## Validation

- npm install: passed.
- npm run typecheck: passed.
- npm run build: passed; production output generated.
- npm run lint: fails on inherited issues. Original base: 7,840 errors (7,839 formatting and one prefer-const), plus 13 warnings. Final: 7,720 errors. New grid/effects files have zero lint errors. Unrelated lint issues were left untouched.
- Data assertions: all 36 original records preserved and every floor has 12 unique, correctly zoned positions.
- Browser interaction/visual tests: NOT completed. Chromium was unavailable and its download failed in the execution environment. Desktop, mobile, touch and reduced-motion behavior need a local browser smoke test.

## Run

From parking_proj:

```sh
npm ci
npm run dev
```

Use the existing project environment configuration. The project uses the original TanStack Start/Vite setup. No deployment was performed.

## Local smoke test

Open /parking. Select an available bay and check the existing summary updates; occupied/reserved bays must not change it. Switch floors and zone filters. Drag then release over a bay without selecting it, test zoom/reset, and select with Enter/Space. Check the map on / (preview) and /admin, on a phone-width viewport, and with reduced motion enabled. Existing booking/backend behavior is preserved, not newly implemented or certified by this port.
