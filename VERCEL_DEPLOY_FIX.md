# Vercel deployment fix

## Required environment variables

Add these in Vercel Project Settings → Environment Variables, then redeploy:

```env
GEMINI_API_KEY=your_real_google_ai_studio_key
GEMINI_MODEL=gemini-3.1-pro-preview
BRAVE_SEARCH_API_KEY=
```

Use Production, Preview, and Development scopes if you want all deployments to work.

## Do not commit secrets

Keep `.env.example` as placeholders only. Do not put real Gemini keys in GitHub.

## Verify the API route

After deploy, open:

```txt
https://your-domain.vercel.app/api/health
```

You should see JSON with:

```json
{
  "ok": true,
  "hasGeminiKey": true,
  "apiMode": "vercel-function"
}
```

## SQLite note

Vercel serverless storage is ephemeral. This build uses `/tmp/ironcore.sqlite` so the API can boot, but persistent memory/tasks/files require a hosted database like Supabase, Neon, or Turso.
