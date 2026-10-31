# EduBridge

**Learn From Others. Share What You Know. Grow Together.**

A responsive student mentorship and peer-learning starter application. This simplified version uses **Node.js + Express** and local JSON files for persistence (no SQL database required). The interface uses a professional deep-blue / charcoal palette.

## Features in this build

- Separate student and mentor registration / sign-in with role-aware navigation.
- Mentor profiles and student-facing mentor discovery/search.
- Mentor profile detail view, including resources uploaded by that mentor.
- Resource upload for both students and mentors; uploaded resources appear in the shared library, and mentor resources appear on the mentor's profile. Files up to 12 MB are supported (PDF, common images, DOC/DOCX, PPT/PPTX and TXT).
- Community doubt posting and peer replies.
- Mentorship session requests, mentor accept/decline, and completion status.
- Optional skill exchange board.
- In-platform participant-to-participant messaging.
- Basic report submission.
- Responsive dashboard tiles for mentors, doubts, resources, sessions, skill exchange, messages, reports and profile.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

1. Extract the ZIP.
2. Open a terminal in the `edubridge` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. (Recommended) Copy `.env.example` to `.env` and set a long random `SESSION_SECRET`. The app runs with a development fallback secret if you skip this step.
5. Start the app:

   ```bash
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000).

For automatic restart during development, use `npm run dev`.

## Data and uploads

- User accounts and app records are stored as JSON files in `data/`.
- Uploaded files are stored in `uploads/`.
- Both directories are created automatically. They are excluded from source control by `.gitignore`; the included `.gitkeep` files preserve the folders in the project.
- Back up `data/` and `uploads/` to preserve your local demo data.

## Important limitations

This is a local/demo starter, not a production-ready hosted service. It deliberately avoids SQL and uses simple JSON-file persistence. Do not run multiple server instances against the same JSON files. For a public deployment, replace the default in-memory session store with a persistent session store, use HTTPS, set a strong `SESSION_SECRET`, add CSRF protection and rate limiting, scan uploaded files, move uploads to private object storage, and add a real admin/moderation workflow. Mentor verification is never automatically granted; this build displays the status but does not implement administrator review. Notifications are represented by in-app workflow updates rather than email or push delivery. The simplified report flow stores reports but does not provide an admin console. Direct messaging is participant-scoped but is not end-to-end encrypted.

## Project structure

```text
edubridge/
├── data/                 # JSON persistence files created on first use
├── public/
│   ├── app.js            # Frontend views and API interactions
│   ├── index.html        # Landing, auth and dashboard markup
│   └── styles.css        # Responsive deep-blue theme
├── uploads/              # Uploaded learning resources
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js             # Express API, authentication and file uploads
```

## Build / deployment

There is no separate frontend compilation step. `npm start` runs the Node.js server and serves the frontend from `public/`. Deploy to a Node.js 18+ host that supports persistent disk storage, configure environment variables, and ensure the `data/` and `uploads/` directories are writable. The local JSON persistence is intended for a single-instance demo; use a production database or managed data service before scaling.
