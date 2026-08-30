# Cloudflare Pages and D1 Deployment

## Required resources

- A Cloudflare Pages project whose build command is `npm run build`
- Build output directory `dist`
- A D1 database bound to Pages Functions as `DB`
- A secret named `RUN_SIGNING_SECRET` containing at least 32 random characters

## Production setup

### 1. Create the D1 database

```sh
npx wrangler d1 create dragon-hunt-leaderboard
```

Copy the printed `database_id` UUID into `wrangler.toml` under `[[d1_databases]]`.

### 2. Apply migrations

```sh
npm run db:migrate:remote
```

### 3. Set the signing secret

```sh
npx wrangler pages secret put RUN_SIGNING_SECRET
```

Enter at least 32 random characters when prompted. This secret is used to sign and verify run tokens. **Never** store the production value in `.env`, `.dev.vars`, Git, screenshots, or logs.

### 4. Deploy

```sh
npm run deploy
```

This builds static assets into `dist/` and deploys to Cloudflare Pages. The D1 binding in `wrangler.toml` is used automatically.

If you prefer dashboard bindings instead of `wrangler.toml`, go to **Workers & Pages → your project → Settings → Bindings**, add the D1 binding `DB`, and select the production database. Redeploy after changing bindings.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in a development-only secret:

```sh
cp .dev.vars.example .dev.vars
```

Build assets, apply migrations locally, then start the dev server:

```sh
npm run build
npm run db:migrate:local
npm run dev
```

Open `http://localhost:8788`. Wrangler persists local D1 data by default.

## Rate-limit maintenance

Migration `0002_cleanup_expired_rate_limits.sql` installs a D1 trigger that removes expired rate-limit rows whenever a new rate-limit row is inserted. No separate cron Worker is required. To roll back only this maintenance behavior, run `DROP TRIGGER IF EXISTS cleanup_expired_rate_limits;` against the database.

## Asset replacement

Replace `assets/ryku/ryku-game.png` or files under `assets/companion/`, then update frame dimensions and normalized hitboxes in `src/assets.js`. No gameplay or server rule changes are required when only visual assets change.
