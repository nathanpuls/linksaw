# React preview

The React migration lives in `react-web/`. It is intentionally separate from the production files in `web/app/`.

## Safety boundary

- Production continues to serve `web/app/` using `wrangler.toml`.
- The preview uses `wrangler.react-preview.toml`, a separate Worker, and a separate D1 database.
- Preview cookies are host-only and preview share links use the preview origin.
- `PREVIEW_SEED=true` adds representative samples only to a new preview user's empty library.
- Never replace the isolated preview database ID with the production database ID.

## Local development

1. Apply the migrations locally with the preview configuration.
2. Start the Worker on port 8799.
3. Run `npm run react:dev`; Vite proxies API requests to the local Worker.

## Preview deployment

1. The isolated `linksaw-react-preview` D1 database is configured in `wrangler.react-preview.toml`.
2. Apply every migration with `wrangler d1 migrations apply linksaw-react-preview --remote --config wrangler.react-preview.toml`.
3. Add preview-only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` secrets.
4. Register `https://react-preview.linksaw.com/auth/callback` in the preview OAuth client.
5. Build with `npm run react:build` and deploy with `wrangler deploy --config wrangler.react-preview.toml`.
6. Route `react-preview.linksaw.com` to the preview Worker.

Production rollout is deliberately not part of this configuration and requires explicit approval after parity testing.
