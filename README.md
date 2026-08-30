# Ryku Hunt

Ryku Hunt is an original responsive Canvas shooting game with two modes:

- **Game A:** one Ryku per wave, ten waves per round
- **Game B:** two Ryku targets per wave, five waves per round

Each wave provides three shots. A round contains ten targets and requires progressively more hits to continue. Players choose or generate a username and can submit deterministic server-verified runs to a Cloudflare D1 leaderboard.

## Development

Requires Node.js 20 or newer.

```sh
npm test
npm run lint
npm run build
npm run serve
```

Open `http://localhost:4192`. Static local serving uses the offline leaderboard fallback.

### Live leaderboard (local)

To test with the D1-backed leaderboard locally:

```sh
cp .dev.vars.example .dev.vars   # fill in a dev-only signing secret
npm run build
npm run db:migrate:local
npm run dev                       # opens http://localhost:8788
```

### Deploy to Cloudflare Pages

See [docs/cloudflare-pages.md](docs/cloudflare-pages.md) for full production setup (D1 database, `RUN_SIGNING_SECRET`, and deployment).

## Replace character artwork

Character paths, sprite dimensions, animation frame counts, and normalized hitboxes live in `src/assets.js`. The current Ryku sprite is stored at `assets/ryku/ryku-game.png` and can be replaced without changing the game engine.

## Project status

Version `0.1.0`. This is an original community game and does not use official Raiku logos, avatars, or protected game characters.
