# OA Simulator frontend

A browser app for practising timed online assessments. A student builds a round (topic and difficulty for each
question), starts a strict no-pause timer, solves Python problems in a code editor, runs the sample tests,
submits against all tests, and reads a report of how the round went.

The frontend only calls the OA Simulator backend API. It never runs code and never decides whether an answer is
right. The server owns the clock, the grading and the report.

Built with React 18, Vite, Tailwind CSS v3, React Router, the Monaco editor, and Vitest with React Testing Library.
Plain JavaScript, plain `fetch`, no state library.

## Run it

You need Node.js 20.19 or newer, and the backend running (see [The backend](#the-backend)).

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>.

Type that address yourself. On some machines Vite prints `http://127.0.0.1:5173/` instead, and the browser treats
`127.0.0.1` and `localhost` as different origins. The backend only accepts the origins listed in its `CORS_ORIGIN`
(see [The backend](#the-backend)), so a page opened on any other address shows "Can't reach the server."

Edit `.env` if your backend is not at the default address. Vite reads `.env` when it starts, so restart `npm run dev`
after changing it.

## Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `VITE_API_BASE_URL` | yes | The backend address, for example `http://localhost:5000`. A trailing slash is ignored. |

Every variable that starts with `VITE_` is compiled into the app and can be read by anyone who opens the page.
**Nothing secret goes in `.env`.** The file is git-ignored; `.env.example` is the template.

Product limits (attempts, cooldowns, durations, code size, page size, minimum workspace width) are not
environment variables. They live in one file, `src/config/limits.js`, and must have the same values as the
backend's own `config/limits.js`.

## The backend

The app needs the OA Simulator backend and a MongoDB it can reach.

- Set the backend's `CORS_ORIGIN` to `http://localhost:5173` (this app's address in development). It takes a
  comma-separated list, so add `http://127.0.0.1:5173` too if you want that address to work:
  `CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173`. The address in the browser must match one entry
  exactly. With any other address the browser blocks every call and the app shows "Can't reach the server."
  The backend reads `.env` only when it starts, so restart it after changing the value (nodemon does not watch `.env`).
- The backend's default port is 5000. On macOS, AirPlay Receiver also uses port 5000. If the backend cannot use
  it, give the backend another `PORT` and put the same port in `VITE_API_BASE_URL`.
- The API is described in `docs/OA Simulator System Design Specification.md` (sections 4 and 5.5).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the development server on port 5173. |
| `npm run build` | Builds the production files into `dist/`. The editor is a separate, large chunk that loads only on the workspace page. |
| `npm run preview` | Serves the `dist/` build locally. |
| `npm test` | Runs every test once. |
| `npm run test:watch` | Runs the tests again on each change. |

## Where things are

| Folder | Contents |
| --- | --- |
| `src/api/` | The only place that calls the backend. `client.js` adds the token, normalizes errors and keeps the server clock. |
| `src/auth/` | The session (token in `localStorage`), the route guards, and the start-up check. |
| `src/pages/` | One file per screen: landing, login, register, dashboard, create round, my rounds, round router and details, workspace, report, not found. |
| `src/workspace/`, `src/report/` | The pieces of the two biggest screens. |
| `src/components/`, `src/layouts/`, `src/hooks/`, `src/lib/` | Shared parts: skeletons, error banner, dialog, app shell, `useApi`, clock and format helpers. |
| `src/config/limits.js` | Every product limit. |
| `docs/`, `design/` | The frontend specification, the backend specification and the design files. They are the source of truth: change the app to match them, not the other way round. |

`docs/FRONTEND-SPEC.md` is the main specification. `design/warm_tech_assessment/DESIGN.md` is the visual authority:
every colour, font, radius and shadow in the source comes from it, and a test enforces that.

## Rules the code follows

- **The server's clock decides.** The countdown is computed from the server's `deadline` and `serverTime`, never
  from the laptop clock alone.
- **No hidden data reaches the browser.** Submit shows only Accepted, Not accepted, or a syntax error with its
  line. No test numbers, counts or hidden inputs are shown or kept.
- **No round IDs on screen.** A round is named by its creation date and time.
- **Every data screen has three states:** loading (a skeleton), empty (with the action that fixes it), and error
  (a message with Retry).
- **Features the backend does not support are not built,** not even as disabled controls.

## Tests

`npm test` runs about 900 tests. Besides the usual component and unit tests, three kinds of check guard the rules
above:

- `src/design.test.js` fails on any colour or font that is not in DESIGN.md.
- `src/states.test.jsx` runs the loading, error and not-found checks on every screen.
- `src/removedFeatures.test.js` searches the source for every feature and text the specification removes.

Much of the test data in `src/test/fixtures/` is real: the answers of the backend's own code, captured against a
throwaway database, so the screens are tested against what the API really sends and not against guesses.

## Keyboard

Everything can be used from the keyboard. Focus is shown with a warm ring on every control. Dialogs keep focus
inside them and give it back when they close. In the workspace, the question tabs also move with the arrow keys,
Home and End; Enter or Space opens the focused question.

In the code editor, Tab inserts an indent. To leave the editor with the keyboard, press Monaco's Tab-focus toggle
(Control+Shift+M on macOS), then Tab. This was checked on macOS; Monaco's keyboard shortcuts list the key for other
systems.

## Known trade-offs

- The login token is kept in `localStorage` (the backend issues access tokens only). A script injected into the
  page could read it. This is a known trade-off of the MVP.
- The workspace needs a window at least 1100 px wide and shows a notice on a narrower one. Phones are not
  supported. Other screens are desktop first.

## Future ideas

Not built, on purpose. Each is outside the first version or needs support from the backend first.

- Forgot password and email verification.
- Reset Code in the workspace (a frontend-only feature).
- Search and sorting in My rounds.
- Results across rounds, and a comparison with other students (percentiles).
- Export of a report (the report can be printed today).
- Company presets for the round builder.
- Runs with custom input.
- Languages other than Python.
- Showing a student's code after a round ends.
- Phone and tablet layouts.
- Admin pages.
