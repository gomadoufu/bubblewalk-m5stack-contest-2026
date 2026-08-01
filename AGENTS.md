# AGENTS.md

## Scope

These instructions apply to the entire repository.

BubbleWalk is the public implementation prepared for the M5Stack Global
Innovation Contest 2026. Keep changes within that scope: NanoH2 + Unit NeoHEX
firmware and the showcase Web Bluetooth application.

## Repository map

- `firmware/`: PlatformIO/Arduino firmware for ESP32-H2 (M5Stack NanoH2) and
  the 37-pixel Unit NeoHEX.
- `firmware/src/main.cpp`: top-level state, BLE coordination, persistence, and
  Arduino entry points.
- `firmware/src/*.cpp` and `firmware/include/bubblewalk/*.h`: protocol,
  display, color, and status-LED modules. Keep reusable implementation details
  here instead of growing `main.cpp` unnecessarily.
- `web-app/`: strict TypeScript/Vite showcase application.
- `web-app/src/domain/`: pure domain logic; prefer placing testable logic here.
- `web-app/src/ble/`: Web Bluetooth and GATT protocol handling.
- `web-app/src/data/`: fixed topics and browser-local stores.
- `web-app/test/`: Vitest tests mirroring the relevant source areas.
- `assets/`: privacy-reviewed public demonstration images.

## Product invariants

- The normal flow is: choose a topic and opinion, sync them to a NanoH2, walk
  near other devices, then reveal the local encounter palette.
- BLE encounter exchange is device-to-device and must not require a gateway or
  server.
- Do not add names, stable personal identifiers, participant responses,
  credentials, MAC addresses, analytics, or remote uploads.
- The encounter result is ego-centric, not a public poll. Preserve copy and UI
  behavior that make this distinction clear.
- Preserve the minimum-sample privacy gate and topic/version matching before
  displaying histogram bins.
- The public Web App is a focused, single-flow showcase experience.
- All participant devices use the same firmware image. Runtime identity must
  continue to be derived on the device.
- NeoHEX animations and status indications must remain non-blocking so BLE
  advertising, scanning, and GATT handling continue to run.

## Firmware guidance

- Use the existing `millis()`-driven state-machine style. Avoid long `delay()`
  calls in normal runtime paths.
- Keep on-wire layouts, UUIDs, byte order, CRC behavior, topic fields, and
  histogram sizes aligned with the TypeScript GATT codec.
- Treat `platformio.ini` build flags as part of the public configuration. If a
  default or hardware pin changes, update the relevant documentation in the
  same change.
- Preserve G9 behavior: short press opens the sync window, a 1–5 second press
  returns to encounter mode, and a 5 second hold resets encounter state.
- Do not require device-specific compile-time addresses or per-device builds.
- Avoid dynamic or blocking work in timing-sensitive display and BLE paths.

## Web App guidance

- Keep TypeScript strict and satisfy the existing unused-code and switch-case
  checks in `tsconfig.json`.
- Keep BLE access behind the interfaces in `src/ble/`; keep encoding and
  decoding in `gatt-codec.ts`.
- Put deterministic calculations in `src/domain/` and add or update focused
  Vitest coverage.
- Web Bluetooth requires HTTPS or localhost and a user gesture for device
  selection. Do not design flows that silently connect without a gesture.
- Keep the English, Japanese, Simplified Chinese, and Korean showcase copy in
  `src/localization.ts` aligned when visible UI text changes.
- When changing the displayed version, update the canonical application version
  and any user-visible version references together.

## Verification

Run the checks relevant to the files changed.

For Web App changes:

```sh
cd web-app
corepack pnpm install --frozen-lockfile
corepack pnpm run test
corepack pnpm run build
```

Do not reinstall dependencies if the existing lockfile installation is already
usable and the task does not change dependencies.

For firmware changes:

```sh
cd firmware
pio run
```

Uploading is not a routine verification step because it requires attached
hardware. When hardware testing is requested, identify the port first with
`pio device list`, upload the shared `participant` environment, and report
which device and port were tested.

For protocol changes, verify both firmware and Web App and add or update codec
tests. For documentation-only changes, at minimum inspect the diff and run
`git diff --check`.

## Change discipline

- Read the existing implementation before editing and preserve unrelated user
  changes in a dirty worktree.
- Keep source, tests, README instructions, protocol constants, and version
  surfaces consistent in the same change.
- Prefer small, reviewable changes. Do not reformat or rewrite unrelated files.
- Never commit generated build directories, local device identifiers, secrets,
  participant data, or unreviewed image metadata.
- Do not commit, push, upload firmware, deploy the Web App, or publish contest
  material unless the user explicitly asks.
