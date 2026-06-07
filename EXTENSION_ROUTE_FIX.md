# IronCore Extension Route Fix

This version fixes the Vercel `NOT_FOUND` error shown by the Chrome extension.

## What changed

The extension now calls explicit Vercel API routes:

- `GET /api/health`
- `GET /api/gemini-test`
- `POST /api/extension-command`
- `POST /api/extension-context`

The older nested routes are still available through the catch-all API, but the extension no longer depends on them.

## Test after deploy

Open these URLs after redeploying Vercel:

```text
https://your-app.vercel.app/api/health
https://your-app.vercel.app/api/gemini-test
https://your-app.vercel.app/api/extension-command
https://your-app.vercel.app/api/extension-context
```

Expected:

- `/api/health` returns JSON with `ok: true`.
- `/api/gemini-test` returns Gemini test response.
- `/api/extension-command` should not show Vercel `NOT_FOUND`. It should say the endpoint is online.
- `/api/extension-context` should not show Vercel `NOT_FOUND`. It should say the endpoint is online.

## Extension backend URL

Use only the site root:

```text
https://iron-core-ai-command-hub.vercel.app
```

Do not use:

```text
https://iron-core-ai-command-hub.vercel.app/api/health
https://iron-core-ai-command-hub.vercel.app/api/gemini-test
```

## Chrome internal pages

Chrome pages such as `chrome://downloads`, `chrome://extensions`, and `chrome://settings` are restricted browser pages. The extension can open, but it cannot always read full page text from them. Test on normal `https://` pages for best results.
