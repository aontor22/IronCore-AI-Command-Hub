# GitHub Upload Guide

Recommended repository name:

```text
IronCore-AI-Command-Hub
```

Repository description under 300 characters:

```text
A futuristic AI operating assistant with a cinematic HUD interface, Gemini-powered chat, memory, tasks, file tools, voice controls, and extension-ready APIs. Built as a local productivity command center with secure server-side AI execution.
```

## Upload checklist

1. Unzip this project.
2. Open the project folder.
3. Upload the contents of this folder to the root of your new GitHub repo.
4. Do not upload a real `.env` file.
5. Keep `.env.example` in the repo.
6. Add your `GEMINI_API_KEY` only in your local `.env` or hosting environment variables.
7. Do not commit SQLite database files such as `sqlite.db`, `*.db`, `*.sqlite`, `*.db-wal`, or `*.db-shm`.

## Local run

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Open:

```text
http://localhost:3000
```

If your preview environment blocks Vite websocket/HMR, set this in `.env`:

```env
DISABLE_HMR=true
```

## Chrome Extension Upload Note

This repo now includes a local Chrome extension inside the `extension/` folder.

Do not upload this extension to the Chrome Web Store until you review permissions, privacy policy, branding, and production backend configuration. For local testing, use Chrome Developer Mode and load the unpacked `extension/` folder.

The extension requires the IronCore web app/backend to be running first at `http://localhost:3000`.
