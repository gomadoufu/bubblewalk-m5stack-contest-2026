# NanoH2 + NeoHEX firmware

This PlatformIO project builds the BubbleWalk participant firmware.

## Wiring

Connect the M5Stack Unit NeoHEX to the NanoH2 HY2.0-4P connector. The firmware
uses GPIO 2 for the NeoHEX data signal and drives 37 WS2812-compatible LEDs.

## Source layout

- `src/main.cpp`: application state, BLE coordination, encounter aggregation,
  flash persistence, and the Arduino `setup()` / `loop()` entry points.
- `src/neohex_display.cpp`: NeoHEX ring mapping, encounter placement, center
  pulse, and showcase animations.
- `src/status_led.cpp`: non-blocking onboard status LED patterns.
- `src/color.cpp`: shared RGB blending, scaling, and triangle color mapping.
- `src/byte_codec.cpp`: little-endian payload helpers and CRC-16 calculation.

Public interfaces for the modules live under `include/bubblewalk/`. Hardware
rendering and protocol primitives stay out of `main.cpp`, while the top-level
file remains responsible for coordinating the device as a whole.

## Build

```sh
pio run
```

## Upload

```sh
pio device list
pio run -e participant -t upload --upload-port /dev/cu.usbmodemXXXX
```

All participant devices use the same binary. Runtime identifiers are derived
on the device; this repository does not contain device-specific addresses.

## NeoHEX animations

The animations are part of the normal BubbleWalk interaction; there is no
separate showcase mode.

- **Color bloom:** after a Web Bluetooth opinion sync, the new owner color
  travels from the center through the three rings and settles back into the
  breathing center LED.
- **Encounter pop:** a newly encountered color briefly pulses across its RSSI
  ring and then remains at its assigned near, middle, or far position.
- **Palette orbit:** when the Web App reads the encounter histogram, the stored
  encounter colors orbit around NeoHEX before returning to their normal
  proximity positions.

All three animations use the regular `millis()`-driven display loop. They do
not block BLE advertising, scanning, or GATT handling.

## Button

- Short press after boot: open the BLE GATT synchronization window.
- Press for 1 to 5 seconds: return to encounter mode.
- Hold for 5 seconds: reset the local histogram and recent encounter state.

Do not hold G9 while powering or resetting the NanoH2 because it is also a boot
mode button.
