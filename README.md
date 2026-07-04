# MONKEYALARM! 🚨🐒

A browser-based first-person multiplayer hide-and-seek game built with three.js. The monkeys have escaped, and you're the law: police officers hunt escaped monkeys across four themed maps, either solo against AI monkeys or online with friends via socket.io. Each round flows through a menu → lobby → hiding phase → seeking phase → round-end loop — monkeys scatter and hide while the police are blindfolded, then the hunt begins.

## Requirements

- Node.js ≥ 20

## Setup

```bash
npm install
```

## Running

```bash
npm run dev      # client dev server → http://localhost:5173
npm run server   # multiplayer server on :3010 (only needed for multiplayer — solo modes run serverless)
```

Solo modes (Classic, Time Attack, Free Roam) work entirely in the browser with no server process. For multiplayer, run both commands; the Vite dev server proxies socket.io traffic to the game server.

## Other scripts

```bash
npm run lint     # ESLint
npm run build    # production build (dist/)
```

## Features

- **4 game modes** — Classic Hunt, Banana Infection (multiplayer only), Time Attack, and Free Roam
- **4 maps** — Jungle Temple, City Zoo, Banana Factory, and Treetop Village
- **Solo vs AI** — hunt AI-controlled monkeys with no server required
- **Online multiplayer** — host a room, share the 4-letter code, and play with friends

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| Space | Jump |
| Mouse | Look |
| Left click | Catch (police, within range while facing a monkey) |
