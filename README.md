# Diablo War Plan

Real-time party planning board for Diablo activities.

Players can:
- Join a shared room with a name.
- Build a war plan with duplicate activities allowed.
- Preserve the exact order of picks.
- Submit a manual "done count" number.
- Toggle each submitted plan item as done/undone.
- Persist player progress to disk and restore it on rejoin.
- See all updates live across connected clients.

## Tech Stack

- Node.js
- Express
- Socket.IO
- Vanilla HTML/CSS/JS

## Project Structure

```
.
├─ server.js
├─ package.json
└─ public/
	 ├─ index.html
	 ├─ app.js
	 └─ style.css
```

## Prerequisites

- Node.js 18+ (recommended)
- npm

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open in browser:

```text
http://localhost:3000
```

If port 3000 is in use, run with another port:

```bash
PORT=3100 npm start
```

Then open:

```text
http://localhost:3100
```

## How To Use

1. Enter your name and click "Join War Council".
2. Click activity buttons to add picks into your ordered queue.
3. Add duplicates if needed (for example, same activity multiple times).
4. Enter "How many war plans done" as a non-negative number.
5. Click "Submit War Plan".
6. In "Party War Plans", click your own plan chips to toggle done/undone.

## Current Behavior Notes

- Active player connections are in memory.
- Player progress is persisted to `data/players.json`.
- Rejoining with the same player name restores saved plans and done count.
- Toggling done/undone updates the per-item status icon:
	- `○` = not done
	- `✔` = done
- The manual done count is separate from per-item toggles.

## Scripts

- `npm start`: start the web server.

## Possible Next Improvements

- Auto-calculate done count from toggled items (or sync both directions).
- Add room codes for separate parties.
- Add basic tests for server event handling.