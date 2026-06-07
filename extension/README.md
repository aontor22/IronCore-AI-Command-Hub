# IronCore Chrome Extension Mode

This folder contains the Chrome extension companion for the IronCore AI Command Hub web app.

The extension does not contain any Gemini API key. It sends selected text, page title, URL, and readable page text to your local IronCore web app backend at:

```txt
http://localhost:3000/api/extension/command
```

## Requirements

1. Run the IronCore web app first.
2. Add `GEMINI_API_KEY` to the web app `.env` file.
3. Start the web app with:

```bash
npm install
npm run db:push
npm run dev
```

4. Open the dashboard at:

```txt
http://localhost:3000
```

## Install the extension locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this `extension` folder.
6. Pin the IronCore extension from the toolbar.

## What it can do

- Summarize the current page.
- Explain selected text.
- Extract action items from a page.
- Rewrite selected text.
- Save page context into IronCore memory.
- Open the full IronCore dashboard.
- Use the floating assistant panel injected into normal websites.

## Notes

- The web app must be running for AI features to work.
- The extension reads page text only when you ask it to use page context.
- It cannot run on Chrome internal pages like `chrome://extensions`.
- API keys stay server-side in the web app.
