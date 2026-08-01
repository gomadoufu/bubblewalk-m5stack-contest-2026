# BubbleWalk Showcase Web App

The public, showcase-only interface for BubbleWalk. From the home screen, one
iPad can run either side of the demonstration:

- choose a question and make a color, then send it to BubbleWalk over Web
  Bluetooth; or
- select a BubbleWalk and read its anonymous encounter palette directly.

After sending a color, the guided flow still continues through walking near
other BubbleWalk devices and revealing the resulting palette.

Encounter summaries stay on the device and are shown only after the minimum
display threshold is reached.

The interface supports English, Japanese, Simplified Chinese, and Korean. Use
the expandable language menu in the header to switch languages; the selection
is remembered in the browser.

The open-campus topic asks what visitors would like to focus on at university:
making games or art, connecting with friends, or learning knowledge and skills.
The circular picker blends those three meanings; the selected mix is sent to
BubbleWalk firmware as the existing triangle coordinates.

## Development

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run test
corepack pnpm run build
corepack pnpm run dev
```

Web Bluetooth requires HTTPS or localhost and a compatible browser. Device
selection always requires a user gesture. On iPhone or iPad, open the same URL
in a Web Bluetooth-capable browser such as Bluefy.
