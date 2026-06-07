# IronCore Extension Voice and API Fix

This build fixes the browser companion behavior after Vercel deployment.

## Fixed

- `/api/health` can work while `/api/extension/command` has timeout protection.
- Extension requests now timeout cleanly instead of staying on "Thinking..." forever.
- Backend URL normalization prevents accidentally saving `/api/health` as the base URL.
- Browser context is shortened before sending to Gemini to reduce Vercel function timeouts.
- API key-like strings are redacted from selected text and page text before sending.
- Added voice input and speech output to the extension popup.
- Added voice input and speech output to the floating page panel.
- Improved web app voice status messages.
- Improved 1366x768 dashboard layout so panels do not overlap or create large empty gaps.

## Vercel Environment Variables

Required:

```env
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-3.1-pro-preview
```

Recommended for extension speed:

```env
GEMINI_FAST_MODEL=gemini-3.1-pro-preview
GEMINI_TIMEOUT_MS=22000
EXTENSION_TIMEOUT_MS=18000
```

Optional live search:

```env
BRAVE_SEARCH_API_KEY=
```

## Test URLs

Health check:

```text
https://your-app.vercel.app/api/health
```

Gemini live test:

```text
https://your-app.vercel.app/api/gemini-test
```

## Extension Backend URL

In the extension popup, set Backend URL to the app root only:

```text
https://your-app.vercel.app
```

Do not use:

```text
https://your-app.vercel.app/api/health
```
