# Vercel API Crash Fix

This version fixes the Vercel `FUNCTION_INVOCATION_FAILED` crash by making each Vercel API route standalone.

## What changed

- Removed the shared API helper file from the `api/` directory because Vercel treats files in `api/` as serverless routes.
- Removed top-level imports from `@google/genai` in the Vercel API routes.
- Switched Vercel API calls to the Gemini REST endpoint using server-side `fetch`.
- Kept Gemini keys server-side only.
- Kept local Express app mode unchanged.

## Required Vercel environment variables

```env
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_FAST_MODEL=gemini-3-flash-preview
GEMINI_TIMEOUT_MS=9000
EXTENSION_TIMEOUT_MS=9000
BRAVE_SEARCH_API_KEY=
```

After changing env variables, redeploy the latest production deployment.

## Test URLs

```text
https://your-domain.vercel.app/api/health
https://your-domain.vercel.app/api/gemini-test
https://your-domain.vercel.app/api/extension-command
https://your-domain.vercel.app/api/extension-context
```

Expected `/api/health` response:

```json
{
  "ok": true,
  "status": "running",
  "apiMode": "vercel-standalone-rest-api"
}
```
