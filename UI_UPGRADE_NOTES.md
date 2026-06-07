# IronCore HUD UI Upgrade

This build converts the app into a cinematic Jarvis-style operating dashboard while keeping the existing React + Express + SQLite + Gemini backend.

## Updated UI Features

- Full-screen holographic command-center layout
- Left navigation rail with Dashboard, Chat, Tasks, Memory, Files, Extensions and Settings
- Central animated assistant core with rotating HUD rings
- System status gauges, task meters, memory snapshots and activity feed
- Bottom command dock with chat input, mic button, speak-last-reply button and send action
- Full interactive workspaces for chat, task management, memory, file summarization, extension bridge and settings
- Responsive mobile navigation

## Files changed

- `src/App.tsx`
- `src/client/components/Dashboard.tsx`
- `src/index.css`

## Run

```bash
npm install
cp .env.example .env
# add GEMINI_API_KEY in .env
npm run db:push
npm run dev
```

Open http://localhost:3000
