# TOLTALES

A pocket-sized, turn-based 4X in which rival **folklores** — living storytelling traditions —
compete to become the world's true tale. Single HTML file, vanilla JS, canvas + emoji, no build
step, no external assets.

**▶ Play: https://toltales.pages.dev**

## What's here

| Path | What it is |
|---|---|
| `Tinytopia.html` | The whole game. Open it in a browser — `file://` works. Numbered build log in the header. |
| `functions/api/[[route]].js` | Online room API (Cloudflare Pages Function, KV-backed) |
| `wrangler.toml` | Pages + KV config used for deployment |

## Playing

- **Solo / hot-seat** — works offline from the file itself. Pick a world, map size, CPU rivals and
  difficulty; 1–4 humans can share one device (a pass-the-device curtain hides each player's fog).
- **Online** — on the hosted build only. One player taps **Host online** and reads out the
  **4-digit room code** (it stays pinned in the HUD all match); everyone else taps **Join a code**.
  The host starts once the lobby is full. Turns are strictly sequential and clients poll for the
  handoff, so phones and desktops mix freely.

## Deploying

Deployment is manual — pushing here does **not** publish. From a directory containing
`wrangler.toml` and `public/index.html` (a copy of `Tinytopia.html`):

```bash
npx wrangler pages deploy
```

## Credits

Built against a written design spec, one implementation slice at a time.
Engine baseline: the Tinytopia prototype (commit `847e085`).
