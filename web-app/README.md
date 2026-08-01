# BubbleWalk Showcase Web App

The public, showcase-only interface for BubbleWalk V1. It has one interaction
flow:

1. choose a question and make a color;
2. send the color to NanoH2 over Web Bluetooth;
3. walk near other BubbleWalk devices;
4. reveal the anonymous encounter palette.

Encounter summaries stay on the device and are shown only after the minimum
display threshold is reached.

## Development

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run test
corepack pnpm run build
corepack pnpm run dev
```

Web Bluetooth requires HTTPS or localhost and a compatible browser. Device
selection always requires a user gesture. On iPhone, open the same URL in a
Web Bluetooth-capable browser such as Bluefy.
