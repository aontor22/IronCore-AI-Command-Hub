# IronCore Assistant

Interactive JARVIS-style personal AI operating assistant built with React, Vite, Express, SQLite, Drizzle ORM and Gemini function calling.

This is a safe productivity assistant, not a Marvel copy and not an unrestricted system-control agent.

## What is included

- Premium responsive command dashboard
- Chat assistant panel
- Real browser voice input when supported
- Browser text-to-speech for latest reply
- Task creation, completion, priority and deletion
- Long-term memory save, search and delete
- Text file upload and AI summarization
- Live local server diagnostics
- Safe confirmation queue for sensitive actions
- Extension-ready API endpoints
- Robust JSON fetch handling
- SQLite corruption recovery for local development

## Requirements

- Node.js 18+
- npm
- Gemini API key

## Setup

```bash
npm install
cp .env.example .env
# Add GEMINI_API_KEY to .env
npm run dev
```

Open:

```text
http://localhost:3000
```

## Useful commands

```bash
npm run dev       # Start the Express + Vite dev server
npm run build     # Build frontend and server bundle
npm run start     # Run production build
npm run db:push   # Push Drizzle schema when needed
npm run lint      # TypeScript check
```

## Environment variables

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-pro-preview
BRAVE_SEARCH_API_KEY=optional_brave_key
SQLITE_DB_PATH=sqlite.db
DISABLE_HMR=false
```

Use `DISABLE_HMR=true` if your preview environment blocks Vite websocket live reload.

## API endpoints

### Core

```text
GET    /api/health
POST   /api/chat
GET    /api/chat-history
DELETE /api/chat-history/clear
```

### Tasks

```text
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
```

### Memories

```text
GET    /api/memories?q=keyword
POST   /api/memories
DELETE /api/memories/:id
```

### Files

```text
GET  /api/files
POST /api/upload
POST /api/summarize-file
```

The upload endpoint expects JSON, not multipart form data:

```json
{
  "name": "notes.txt",
  "mimeType": "text/plain",
  "content": "File text here"
}
```

### Safe pending actions

```text
GET  /api/actions
POST /api/actions/:id/confirm
POST /api/actions/:id/cancel
```

Sensitive actions such as email drafts and calendar event drafts are stored as pending actions for confirmation. This local safe build does not send emails or create real calendar events automatically.

## Chrome extension integration plan

The backend is already extension-ready.

### Save current page context

```text
POST /api/extension/context
```

Example body:

```json
{
  "pageTitle": "Example Page",
  "pageUrl": "https://example.com",
  "selectedText": "selected content",
  "pageText": "visible page text snippet"
}
```

### Run a command using page context

```text
POST /api/extension/command
```

Example body:

```json
{
  "userCommand": "Summarize this page",
  "pageTitle": "Example Page",
  "pageUrl": "https://example.com",
  "selectedText": "optional selected content",
  "pageText": "visible page text snippet"
}
```

## Safety model

Safe automatic actions:

- Create tasks
- Save memory
- Retrieve memory
- Read uploaded text files
- Summarize uploaded text files
- Web search when Brave API key is configured

Confirmation-required actions:

- Email drafts
- Calendar event drafts
- Any external sending, booking, deletion, file modification or form submission

## Project structure

```text
Jarvis-main/
├── server.ts
├── vite.config.ts
├── package.json
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── client/
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── SystemStatus.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   ├── useMemories.ts
│   │   │   └── useTasks.ts
│   │   └── lib/
│   │       └── api.ts
│   └── server/
│       ├── ai.ts
│       ├── prompts.ts
│       ├── routes.ts
│       ├── tools.ts
│       └── db/
│           ├── index.ts
│           └── schema.ts
└── README.md
```

## GitHub repo setup

Suggested repository name:

```text
IronCore-AI-Command-Hub
```

Suggested repository description:

```text
A futuristic AI operating assistant with a cinematic HUD interface, Gemini-powered chat, memory, tasks, file tools, voice controls, and extension-ready APIs. Built as a local productivity command center with secure server-side AI execution.
```

Before pushing to GitHub, confirm that `.env` and local database files are not included. This project includes an updated `.gitignore` for Node dependencies, build outputs, secrets, logs, local SQLite files, and runtime uploads.

---

## Chrome Extension Mode

This final package includes two modes:

1. **Web App Mode**: the main IronCore dashboard at `http://localhost:3000`.
2. **Chrome Extension Mode**: the browser companion inside the `extension/` folder.

The Chrome extension is a companion client. It does not call Gemini directly and does not store any AI API key. It sends browser context to the web app backend through these existing local endpoints:

```txt
POST /api/extension/context
POST /api/extension/command
```

### Run the web app first

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Add your key in `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Open:

```txt
http://localhost:3000
```

### Install the extension locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` folder from this project.
6. Pin the extension to the toolbar.

### Extension features

- Popup assistant with the same IronCore HUD styling.
- Floating assistant button on normal websites.
- Summarize the current page.
- Explain selected text.
- Extract action items.
- Rewrite selected text.
- Save browser context to IronCore memory.
- Open the full web dashboard from the extension.

### Important extension notes

- The web app must be running for AI features to work.
- API keys remain in the backend `.env` file only.
- The extension cannot run content scripts on Chrome internal pages such as `chrome://extensions`.
- If the popup says the backend is offline, start the web app with `npm run dev` and check `http://localhost:3000/api/health`.


## Vercel API Fix Notes

This project includes a Vercel API catch-all function at `api/[...path].ts`. It mounts the same Express API routes used locally, so `/api/health`, `/api/chat`, `/api/tasks`, `/api/memories`, `/api/files`, and `/api/extension/command` can work after deployment.

Add these in Vercel Project Settings → Environment Variables:

```env
GEMINI_API_KEY=your_real_google_ai_studio_key
GEMINI_MODEL=gemini-3.1-pro-preview
BRAVE_SEARCH_API_KEY=
```

Do not add a real key in `.env.example`. `.env.example` is only a public template.

Important: SQLite is only temporary on Vercel serverless functions. The app will boot with `/tmp/ironcore.sqlite`, but memory/tasks/files may reset between function instances. Use Supabase, Neon, Turso, or another hosted database for production persistence.

For the Chrome extension, open the popup and set Backend URL to your deployed URL, for example:

```txt
https://iron-core-ai-command-hub.vercel.app
```

## Latest Vercel + Responsive Fix

This package includes a standalone Vercel API function at `api/[...path].ts`. It avoids importing the local Express/SQLite server in Vercel, which prevents serverless crashes from native SQLite dependencies. Local web app mode still uses the normal local server.

After deploying to Vercel, test:

```text
https://your-project.vercel.app/api/health
```

The Chrome extension floating `IC` button is draggable. Drag it anywhere on the page and the extension will remember the position.

## Latest Fix: Extension Voice + Vercel API Stability

This build includes an updated Chrome extension companion and Vercel API handler.

### What changed

- Extension command requests now have timeout handling, so the UI will not stay on "Thinking..." indefinitely.
- The extension now normalizes Backend URL values. Use the app root URL only, for example `https://your-app.vercel.app`.
- Added voice input and speech playback to both the popup and floating panel.
- Added sensitive-key redaction before browser context is sent to the backend.
- Added `/api/gemini-test` for checking whether the Gemini model itself can respond.
- Improved 1366px laptop responsiveness and dashboard panel layout.

### Vercel env variables

```env
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-3.1-pro-preview
GEMINI_FAST_MODEL=gemini-3.1-pro-preview
GEMINI_TIMEOUT_MS=22000
EXTENSION_TIMEOUT_MS=18000
BRAVE_SEARCH_API_KEY=
```

Never commit real keys to `.env.example` or GitHub.
