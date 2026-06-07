# Vercel Deployment Fix

This version fixes the previous `FUNCTION_INVOCATION_FAILED` error by replacing the Vercel API handler with a standalone serverless function.

## What changed

- `api/[...path].ts` no longer imports the local Express server or SQLite modules.
- Vercel API routes now run with a lightweight serverless memory store.
- `/api/health` should return JSON instead of 404/500.
- `vercel.json` now uses `npm run vercel-build` so Vercel builds only the Vite frontend and deploys the API function separately.
- The Chrome extension floating `IC` button is now draggable and remembers its position.
- Dashboard layout has been tightened for 1366×768 and laptop screens.

## Required Vercel Environment Variables

Add these in Vercel Project Settings → Environment Variables, then redeploy:

```env
GEMINI_API_KEY=your_real_gemini_api_key
GEMINI_MODEL=gemini-3.1-pro-preview
BRAVE_SEARCH_API_KEY=
```

`BRAVE_SEARCH_API_KEY` is optional. It is only needed for live web search.

## Test after redeploy

Open:

```text
https://your-project.vercel.app/api/health
```

Expected:

```json
{
  "ok": true,
  "status": "running",
  "hasGeminiKey": true,
  "apiMode": "vercel-serverless-memory"
}
```

## Important production note

Vercel serverless memory is temporary. Tasks, memory, chat history, and files may reset. For production persistence, connect Supabase, Neon, Turso, or another hosted database.
