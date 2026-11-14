# OA Simulator Frontend Specification

*Describes the React frontend. The data contract is the backend spec (OA Simulator System Design Specification, sections 4 and 5.5). Visual tokens come only from DESIGN.md. If anything here conflicts with the backend spec, the backend spec wins for data.*

**Status:** Draft for review. Nothing here is built yet.

## How to read this document

- Rules have IDs (FR1, FR2, ...). Decisions have IDs (FD1, FD2, ...). Each screen and each phase ends with acceptance checks.
- 'Must' means required. Anything not written here is not built. If something is unclear, stop and ask.
- Field names are the exact JSON names the backend returns.
- E1 to E16 refer to the endpoints in backend section 4.4.

## 1. Scope

### 1.1 Purpose

A browser app where a student builds a timed round, solves Python problems in a strict no-pause round, and reads a report for that round. The frontend only calls the API. It never runs code and never decides right or wrong.

### 1.2 In scope

Landing page, register, login, dashboard, create round, my rounds, round details, workspace (countdown, questions, editor, autosave, Run, Submit, Finish), report, and creating the next round from the report.

### 1.3 Out of scope

Forgot password, email verification, honor codes, social login, search and sorting of rounds, results across rounds, comparison with other students, company presets, custom-input runs, languages other than Python, round IDs shown to users, showing code after a round ends, admin pages, and mobile layouts (desktop first).

### 1.4 Stack

- React 18 with Vite, in JavaScript (no TypeScript).
- React Router for routes.
- Tailwind CSS v3, configured with the tokens in DESIGN.md. Do not use Tailwind v4 syntax.
- Monaco editor (package @monaco-editor/react) for the Python editor.
- Fonts and icons as in DESIGN.md: Plus Jakarta Sans, Inter, JetBrains Mono, and Material Symbols Outlined.
- Plain fetch for HTTP. No axios, no Redux, no data-fetching library.
- Vitest and React Testing Library for tests.

## 2. Routes

| Path | Screen | Access |
| --- | --- | --- |
| / | Landing (S1) | Public. Logged-in users go to /dashboard (FR24) |
| /login | Login (S2) | Public only |
| /register | Register (S3) | Public only |
| /dashboard | Dashboard (S4) | Logged in |
| /rounds/new | Create round (S5) | Logged in |
| /rounds | My rounds (S6) | Logged in |
| /rounds/:id | Round router (S7) | Logged in. Sends the user to S7, S8 or S10 by status (FR15) |
| /rounds/:id/workspace | Workspace (S8) | Logged in. ACTIVE rounds only |
| /rounds/:id/report | Report (S10) | Logged in. FINISHED rounds only |
| anything else | Not-found page | Public |

**FR1.** A 404 from the API shows the not-found view for that screen, with a link back to My rounds.

## 3. Global rules

### 3.1 Authentication

- **FR2.** The token is stored in localStorage under the key `oa.token`. The user object is stored under `oa.user`. See FD11.
- **FR3.** Every protected request sends the header `Authorization: Bearer <token>`.
- **FR4.** On app start, if a token exists, call E4 (`GET /api/auth/me`). If it returns 401, clear the stored token and user, then go to /login.
- **FR5.** Any 401 UNAUTHORIZED from any call clears the stored token and user, then goes to /login with a `returnTo` query parameter. After a successful login, the user goes back to `returnTo`.
- **FR6.** Logout deletes `oa.token` and `oa.user` and goes to /login. There is no server call, because the backend has no logout endpoint.

### 3.2 API client

- **FR7.** All HTTP calls go through one module, `src/api/client.js`. Its base URL comes from the environment variable VITE\_API\_BASE\_URL.
- **FR8.** Every failure is normalized to `{ status, code, message, details, retryAfterSeconds }`. For COOLDOWN, `retryAfterSeconds` is `details.retryAfterMs` divided by 1000, rounded up. A failed network request gives the code NETWORK\_ERROR.
- **FR9.** A response that is not valid JSON, where JSON was expected, is treated as INTERNAL\_ERROR.
- **FR10.** The client never logs request or response bodies.

### 3.3 Error codes

Every call uses this table. Screen-specific wording is in each screen.

| Code | HTTP | Default behaviour |
| --- | --- | --- |
| VALIDATION\_ERROR | 400 | Show each message under the field named in details. If no field is named, show a banner |
| UNAUTHORIZED | 401 | FR5 |
| INVALID\_CREDENTIALS | 401 | Login banner: Email or password is incorrect. |
| NOT\_FOUND | 404 | The not-found view for that screen (FR1) |
| EMAIL\_TAKEN | 409 | Message under the email field |
| READY\_LIMIT\_REACHED | 409 | Banner: You already have 20 ready rounds. Start or delete one first. |
| ROUND\_NOT\_READY | 409 | Reload the round and route by its status (FR15) |
| ACTIVE\_ROUND\_EXISTS | 409 | Banner with a link to the active round |
| ROUND\_NOT\_ACTIVE | 409 | Reload the round and route by its status |
| ROUND\_EXPIRED | 409 | Go to the report (S10) |
| ROUND\_NOT\_FINISHED | 409 | Reload the round and route by its status |
| CODE\_TOO\_LARGE | 413 | Message: Your code is longer than 51,200 characters. |
| NOT\_ENOUGH\_PROBLEMS | 422 | Highlight the groups named in details (see S5) |
| COOLDOWN | 429 | Disable that button for retryAfterSeconds and show the wait |
| ATTEMPT\_LIMIT | 429 | Disable that button for this question |
| TOO\_MANY\_REQUESTS | 429 | Banner: Too many requests. Try again in N seconds. |
| RUNNER\_UNAVAILABLE | 503 | Message: Something went wrong. Try again. The attempt was not counted. |
| INTERNAL\_ERROR | 500 | Banner: Something went wrong. Try again. |
| NETWORK\_ERROR | none | Banner: Can't reach the server. Check your connection. With a Retry button |

### 3.4 Round routing

**FR15.** When a round's status is known, the user goes to:

- READY: S7 (round details)
- ACTIVE: S8 (workspace)
- FINISHED: S10 (report)

Any screen that finds a round in a state it doesn't expect uses this rule.

### 3.5 Clock

- **FR11.** The server's clock is the only source for the countdown. The laptop clock is used only to measure elapsed time between two requests.
- **FR12.** Each response that contains `serverTime` sets the offset: `offsetMs = Date.parse(serverTime) - Date.now()`, measured at the moment the response arrives.
- **FR13.** Remaining time is `Date.parse(deadline) - (Date.now() + offsetMs)`, never below 0.
- **FR14.** The countdown updates once per second. Digits use tabular numbers (JetBrains Mono), so the layout does not shift.

### 3.6 Display rules

- **FR17.** Times from the server are UTC. Show them in the browser's local time as `11 Nov 2026, 13:20`.
- **FR18.** Round IDs are never displayed. A round is named by its creation date and time.
- **FR19.** Durations are shown in minutes, for example `60 min`. Time used is shown as `h h m min` when over an hour.
- **FR20.** No screen shows hidden test data, test numbers, the number of hidden tests, or memory use. Show only what this spec lists.
- **FR21.** Colours, fonts, radii, shadows and spacing come only from DESIGN.md. Do not invent values.

### 3.7 States

- **FR22.** Every data screen has three states: loading (a skeleton shaped like the content), empty (with the action that fixes it), and error (the message with a Retry button).

### 3.8 Route guards and leaving the page

- **FR23.** A logged-out user who opens a protected route goes to /login with `returnTo`.
- **FR24.** A logged-in user who opens /, /login or /register goes to /dashboard.
- **FR25.** While any question in the workspace has unsaved code, closing or reloading the page shows the browser's leave-page warning.

## 4. Screens

### S1 Landing (/)

**Purpose:** explain the product and send the visitor to Register or Login.

**Shows:**

- A headline and one sentence: practise timed Python problems in rounds you build yourself, then read a report of how the round went.
- Four steps: Build a round, Start the timer, Solve and Run, Read your report.
- Four feature cards, each one true: Round builder (topic and difficulty for each question), Server-timed rounds (the server keeps the clock), Run on samples and Submit on all tests, and a round report with insights.
- Two buttons: Create account (to /register) and Log in (to /login).

**Endpoints:** none.

**Removed from the design:** the statistics (pass rate, response time, Python version), the in-browser runner claims, testimonials, and footer pages that have no design. Keep only a copyright line and the two links.

**Acceptance:**

- Every claim on the page is true for the product.
- Both buttons work.
- A logged-in user is redirected (FR24).

### S2 Login (/login)

**Shows:** an email field, a password field with a show/hide toggle, a Sign in button, and a link to Create account.

**Fields:**

- Email: required, checked for format in the browser.
- Password: required.

**Action:** Sign in calls E3 `POST /api/auth/login` with `{ email, password }`.

**On success:** store the token and user (FR2), then go to `returnTo` or /dashboard.

**Errors:**

- VALIDATION\_ERROR: show the field messages.
- INVALID\_CREDENTIALS: banner Email or password is incorrect. Clear the password field. One message for both a wrong email and a wrong password.
- TOO\_MANY\_REQUESTS: banner with the wait time.
- NETWORK\_ERROR or INTERNAL\_ERROR: banner with Retry.

**Removed:** Forgot password, Remember session, the verified-credentials and student-email text, the social login note, the testimonial, and the stats panel.

**Acceptance:**

- No error banner shows on page load.
- A wrong password and an unknown email show the same message.
- Enter submits the form.

### S3 Register (/register)

**Fields:**

- Full name: 2 to 50 characters after trimming.
- Email: a valid format, at most 254 characters.
- Password: 8 to 72 bytes, counted as UTF-8 bytes, not characters.
- Confirm password: must equal Password. This check happens in the browser only.

**Password checklist:** under the password field, three rows: At least 8 bytes, At most 72 bytes, Matches the confirmation. Each row ticks when satisfied. This replaces the strength bar, since the bar didn't follow the real rule (FD4).

**Show/hide toggles** on both password fields.

**Action:** Create account calls E2 `POST /api/auth/register`.

**On success:** store the token and user (the register response includes a token, D21), then go to /dashboard.

**Errors:**

- VALIDATION\_ERROR: field messages.
- EMAIL\_TAKEN: under the email field, This email already has an account.
- TOO\_MANY\_REQUESTS: banner with the wait time.
- NETWORK\_ERROR or INTERNAL\_ERROR: banner with Retry.

**Removed:** the honor-code checkbox (the backend has no meaning for it), marketing text, social proof, and the sample values the design fills in, including a password. All fields start empty.

**Acceptance:**

- A mismatched confirmation blocks submit with no network call.
- No field is pre-filled.
- A successful register lands on /dashboard, logged in.

### S4 Dashboard (/dashboard)

**Layout:** the app shell (sidebar with Dashboard, My rounds, Create round, and Log out; a top bar with the user's name).

**Greeting:** `Hi, {name}`, from `oa.user`.

**Stat cards (4):** Rounds, Ready, Active, Finished. The numbers are the `total` from E7, one call per status with `limit=1`, plus one call with no status filter.

**Active round card** (shown only if one exists):

- Find it with E7 (`status=ACTIVE`, `limit=1`). Then E8 for its details.
- Show the start time, the countdown (FR11 to FR14), and the list of questions.
- Each question row shows `Q n · topic · difficulty` and a status chip, computed from the slot:
  - Not opened: `opened` is false.
  - Opened: `opened` is true, `runCount` and `submitCount` are 0, and `solved` is false.
  - Attempted: `runCount + submitCount` is above 0, and `solved` is false.
  - Solved: `solved` is true.
- Button Resume goes to /rounds/:id/workspace.

**Ready round card** (shown only if one exists): the newest READY round from E7 (`status=READY`, `limit=1`). Show the created date and time, the duration, and the question count. Button Start goes to /rounds/:id, where Start actually happens (FD6).

**Recent rounds table:** E7 with `limit=5`. Columns: Created, Duration, Questions, Solved, Status, Ended (labels as in S6). A link to My rounds.

**Create round** button goes to /rounds/new.

**Empty states:**

- No rounds at all: the text You have not created a round yet, with a Create round button.
- No active round or no ready round: the card is not shown.

**Removed:** the total solved across rounds and its percentage, the PRO PLAN card, the Candidate role text, the Performance menu item, readable round IDs, the auto-save status line (the API has no save time), the tests-passed label, and Delete (Delete lives in S6 and S7).

**Acceptance:**

- Each stat equals the matching E7 total.
- The countdown stays correct when the laptop clock is changed (test by changing the offset).
- Resume opens that round's workspace.

### S5 Create round (/rounds/new)

**On open:** E5 `GET /api/topics`. The topic list comes only from this response. It is not written into the code (FD10).

**Layout:** a question-count control (1 to 5, default 3, with + and - buttons), one card per question, and a summary panel.

**Question card:**

- Topic: a select with only the topics from E5.
- Difficulty: a segmented control with Easy, Medium and Hard. Each option shows how many approved problems exist for the chosen topic at that difficulty, from E5. An option with 0 is disabled.
- A line showing the count, for example `4 problems available`.
- A Remove button, disabled when only one question remains.

**Availability check (before any request):** if the same topic and difficulty appear k times and the available count is smaller than k, the cards show `Only n problems available for this topic and difficulty.` Create round stays disabled until this is fixed. The backend checks this too; the browser check only saves a round trip.

**Summary panel:**

- Number of questions.
- Suggested minutes: the sum of SUGGESTED\_MINUTES for each question's difficulty.
- Duration: a whole-number field, 5 to 180.
- Use suggested button.

**Duration rule:** the default is the suggested total. It follows changes to the difficulties until the student types in the duration field. After that it stays put, and Use suggested resets it.

**Action:** Create round calls E6 `POST /api/assessments` with `{ slots: [{ topic, difficulty }] in order, durationMin }`.

**On 201:** go to /rounds/:id (S7).

**Errors:**

- VALIDATION\_ERROR: a duration outside 5 to 180 shows under the duration field.
- NOT\_ENOUGH\_PROBLEMS (422): the `details` list short groups, each with slot numbers, topic, difficulty, the number requested, and the number available. Mark those slot cards: `Not enough {difficulty} {topic} problems: {requested} requested, {available} available.`
- READY\_LIMIT\_REACHED: the banner from section 3.3.

**Removed:** the hard-coded topic list, Target preset, the full-screen lockdown, camera and window-switch text, the total pool count (only per-group counts are shown), and the made-up question subtitles.

**Acceptance:**

- Topics come only from E5, and a topic with no problems does not appear.
- With one question of 'easy', the duration defaults to 12.
- A 422 highlights exactly the slots named in details.
- A round with one question can be created.

### S6 My rounds (/rounds)

**Filter pills:** All, Ready, Active, Finished. Each sets the `status` query parameter (All sets none). Changing the filter returns to page 1.

**Table columns:** Created, Duration, Questions, Solved, Status, Ended, Actions.

- Solved: `solvedCount` of `questionCount`.
- Status badge: READY (gold), ACTIVE (coral with a pulsing dot), FINISHED (neutral).
- Ended: `finishReason` EXPIRED shows Time ran out; MANUAL shows Finished by you; READY and ACTIVE rows show a dash.

**Actions by status:**

- READY: Start (goes to /rounds/:id) and Delete. Delete asks first (`Delete this round? This cannot be undone.`), then calls E9. On 204, remove the row and show a short confirmation.
- ACTIVE: Resume (goes to /rounds/:id/workspace).
- FINISHED: View report (goes to /rounds/:id/report).

**Paging:** `page` and `limit` query parameters, with `limit` = PAGE\_SIZE. Previous and Next buttons. The page count is computed from `total`.

**Order:** newest first, fixed.

**Empty states:** no rounds at all shows No rounds yet with a Create round button. No rounds for a filter shows No {status} rounds.

**Removed:** search, sort options, topic chips per row, remaining time, the success rate, round numbers such as Round #8, the code view, Schedule New Mock, and readable IDs.

**Acceptance:**

- Totals match the counts.
- Paging moves through the pages.
- The row disappears only after E9 returns 204.

### S7 Round details (/rounds/:id, READY only)

**On open:** E8. Route by status (FR15). Only READY rounds are shown here.

**Shows:**

- A READY badge.
- Cards for Duration (min), Questions (count), and Created (date and time).
- One locked card per question, showing `Q n`, the topic and the difficulty. No statement, samples or code. Nothing from the question appears until the round starts.
- A rules panel with the same text for every round:
  - The clock starts when you press Start and does not pause.
  - You can move between questions freely.
  - Run checks the sample tests. You can run each question up to 30 times, at most once every 3 seconds.
  - Submit checks every test. You can submit each question up to 20 times, at most once every 5 seconds.
  - Only one round can be active at a time.
  - You can finish early. When time runs out, the round finishes on its own.

**Actions:**

- Start calls E10 `POST /api/assessments/:id/start`. On 200, go to /rounds/:id/workspace. Disable the button while the request is pending, so a double click cannot start it twice.
- Delete asks first (`Delete this round? This cannot be undone.`), then calls E9. On 204, go to /rounds with a short confirmation.
- Back to My rounds.

**Errors on Start:**

- ACTIVE\_ROUND\_EXISTS: banner `You already have an active round.` with a link to it. Find it with E7 (`status=ACTIVE`).
- ROUND\_NOT\_READY: reload the round and route by status.
- NOT\_FOUND: the not-found view.

**Removed:** `Expires in 7 days` (READY rounds never expire, D9), the fake server terminal, latency and sandbox text, the memory cap, the execution-timeout number, the Python version, and the keymap options.

**Acceptance:**

- After Start, the workspace shows the same deadline the API returned.
- Starting the same round in two tabs: the second shows the route-away result (ROUND\_NOT\_READY), not a second clock.
- Delete removes the round only after confirmation.

### S8 Workspace (/rounds/:id/workspace, ACTIVE only)

**Width rule (FD8):** below WORKSPACE\_MIN\_WIDTH\_PX (1100), show `This workspace needs a wider screen. Please use a computer.` and nothing else.

**Layout:** a header across the top. The left panel (45%) has the question tabs and the problem. The right panel (55%) has the editor and the results console.

**Header:**

- The round's start time.
- The countdown in MM:SS (or H:MM:SS over an hour), from FR11 to FR14. It turns amber under WARNING\_SECONDS (300).
- A Finish button.

**Question tabs:** one per question, labelled `Q n · Topic · Difficulty`, taken from E8. The statement title is never shown in a tab until that question has been opened (FD9). A status chip shows the state as on S4.

**Problem panel** for the selected question:

- Title (from E12).
- Statement, with line breaks preserved.
- Input format, output format, and constraints.
- Samples: each sample shows its Input and Output in monospace blocks, plus its explanation.

**Editor:** Monaco, language Python, with a fixed label `Python 3`. No language selector (D2). Editor colours come from DESIGN.md. If DESIGN.md has no editor section, use the dark charcoal in the design file (#1C1A18) and add it to DESIGN.md.

**Toolbar:** Run, Submit, and a line for this question: `Runs left 27 · Submits left 20`. Cooldown text appears when a button is waiting.

**Results console:** below the editor, showing the last Run or Submit result for this question (S9).

**Behaviour:**

- **Entry:** call E8. If the status is not ACTIVE, route by status (FR15). Set the clock offset (FR12). Select the first question, or the last one selected in this visit.
- **Opening a question:** the first time a tab is selected, call E12 `GET /api/assessments/:id/questions/:index/open`. The response gives the title, statement, samples and the saved code. Put the saved code in the editor. Do not call E12 for every question on entry, because each call starts that question's clock.
- **Revisiting an opened question:** do not call E12 again. Use the in-memory state.
- **In-memory state per question**, kept only while the tab is open: `code`, `lastSavedCode`, `saveState` (saved, saving or not saved), and the last Run or Submit result.
- **Switching questions:** if the current question has unsaved code, save it first, then switch. Never drop unsaved code.
- **Autosave:** after each change, wait AUTOSAVE\_DEBOUNCE\_MS (1500) after the last keystroke. Then call E13 `PUT .../questions/:index/code` with `{ code }`, but only if `code` differs from `lastSavedCode`. On 204, set `lastSavedCode` and `saveState` to saved. On failure, set `saveState` to not saved and show `Not saved. Retrying on your next change.`
- **Pre-deadline save:** when remaining time is at or below PRE\_DEADLINE\_SAVE\_SECONDS (15), save at once if there are unsaved changes, and save every change immediately, without the debounce.
- **Size:** if `code` is longer than MAX\_CODE\_CHARS (51,200), show `Your code is longer than 51,200 characters.` and do not send it.
- **Expiry:** when remaining time reaches 0, make the editor read-only and disable Run, Submit and Finish. Try one last save and ignore its failure. Then call E8. If the status is FINISHED, go to S10. If it is still ACTIVE, the server clock is ahead; retry E8 every 2 seconds, up to 10 times, then show `Waiting for the server to close the round.`
- **Finish:** a confirmation dialog: `Finish the round now? You cannot run or submit after this.` with Finish round and Cancel buttons. On confirm, try to save unsaved code (a failure does not block), then call E11 `POST /api/assessments/:id/finish`. Go to S10. E11 is safe to repeat.

**Errors in the workspace:**

- ROUND\_EXPIRED on any call: go to S10.
- ROUND\_NOT\_ACTIVE: route by status.
- NOT\_FOUND: the not-found view.

**Removed:** the language selector, Reset Code, scratchpad notes, custom inputs, titles on unopened question tabs, test counts, text such as `all 45 hidden test edge-cases`, the timestamped stdout console, the runtime and memory header, and Java, C++ and TypeScript.

**Acceptance:**

- With a laptop clock set 10 minutes wrong, the countdown still matches the server.
- A page refresh keeps the same deadline and the saved code.
- Typing, then switching question within 1.5 seconds, still saves the code.
- At 0:00 the user reaches the report with no click.
- Opening an unopened question calls E12 once. Reopening it calls nothing.
- A failed save shows Not saved, and the typed code stays in the editor.

### S9 Run and Submit results (inside S8)

**Run result card:**

- If `compilation` is not null: heading `Syntax error`, then its message (for example `Line 3: SyntaxError: invalid syntax`). Do not list samples.
- Otherwise: heading `Run: X of Y sample tests passed`, using `testsPassed` and `totalTests`. Then one card per result, showing:
  - Input (monospace).
  - Expected output (monospace).
  - Your output (monospace). Empty output is shown as `(no output)`.
  - Result: Passed or Failed.
  - For a failure, the reason from `status`: RUNTIME\_ERROR shows `Runtime error` and its `error` text; TIME\_LIMIT\_EXCEEDED shows `Time limit exceeded`; OK with different output shows nothing extra.
- Footer: runs left for this question.

**Submit result card:**

- ACCEPTED: `Accepted` in green, and `Your solution passed all tests.` The question's status chip changes to Solved.
- NOT\_ACCEPTED: `Not accepted.` and `Some test cases did not pass.` Nothing more. No reason, no details, no test numbers.
- COMPILATION\_ERROR: `Syntax error` and `errorMessage`.
- Footer: submits left for this question.

**Never shown:** test numbers, per-test results on Submit, hidden data, or the reason for NOT\_ACCEPTED.

**Button rules:**

- Run is disabled while a Run is pending, during its cooldown, and when runs left is 0.
- Submit is disabled while a Submit is pending, during its cooldown, and when submits left is 0.
- After a successful Run, Run waits RUN\_COOLDOWN\_MS (3000). After a successful Submit, Submit waits SUBMIT\_COOLDOWN\_MS (5000). A server COOLDOWN response overrides this with `retryAfterSeconds`.

**Counters:** when a question is opened, runs left is MAX\_RUNS minus the slot's `runCount`, and submits left is MAX\_SUBMITS minus `submitCount`, both from E8. After each response, use the `runsLeft` or `submitsLeft` it returns.

**Errors:**

- COOLDOWN: `Wait N seconds before running again.` (or submitting).
- ATTEMPT\_LIMIT: `No runs left for this question.` or `No submits left for this question.`
- CODE\_TOO\_LARGE: the message from S8.
- RUNNER\_UNAVAILABLE: `Something went wrong. Try again.` The counter must not change.
- ROUND\_EXPIRED and ROUND\_NOT\_ACTIVE: the S8 rules.

**Acceptance:**

- All four Submit outcomes display correctly against the real backend.
- The Submit result shows no reason and no test number.
- A RUNNER\_UNAVAILABLE response leaves the counter number unchanged.
- The cooldown seconds match the backend.

### S10 Report (/rounds/:id/report, FINISHED only)

**On open:** E16 `GET /api/assessments/:id/report`. On 409 ROUND\_NOT\_FINISHED, route by status (FR15). On 404, show the not-found view.

**Header:** the round's date and time, the duration, how it ended (Time ran out or Finished by you), and the grade badge.

**Grade labels and colours:**

- EXCELLENT: `Excellent`, green.
- STRONG: `Strong`, green.
- SOLVED\_WITH\_STRUGGLE: `Solved with struggle`, gold.
- PARTIAL: `Partially solved`, gold.
- NEEDS\_WORK: `Needs work`, error colour.

**Summary row** (from `summary`): Solved (`solved` of `total`), Time used, Allotted, Time left. Show whole minutes.

**Headline:** the `headline.text` string, large. Its tone decides the style (see the tone table).

**Insights:** up to three cards, in the order given. Each card shows its `text` and its tone style.

**Tone table (FD8 in the design decisions):**

| Rule | Tone |
| --- | --- |
| TOO\_EASY | good (green) |
| every other rule | warning (gold) |

**Time map:**

- One row per question, labelled `Q n`.
- A scale from 0 to `timeMap.totalMinutes`, with a tick every 5 minutes.
- A filled cell for each minute in that question's `activeMinutes`.
- Caption: `Minutes from the start of the round. Filled minutes show when you were working on each question. This is approximate, because reading without typing is not counted.`
- The exact shape is defined in backend section 5.5. If the API differs, the backend spec is corrected first.

**Question table:** one row per question, with these columns:

- Question: `Q n · topic · difficulty`.
- Result: Solved, Not solved, or Not opened.
- Active time: `activeMin of expectedMin min`.
- First run: `firstRunAfterMin` minutes after opening, or a dash.
- Runs and submits: `runCount` / `submitCount`.
- Failed submits: `failedSubmits`.
- Speed (solved only): the time against the limit, for example `0.4 s of 2 s`, from `runtimeMs` and `timeLimitMs`.
- Why not solved: the failure label below.
- Flags: the flag labels below, comma-separated.

**Failure labels (from `failureReason`):**

- TOO\_SLOW: `Too slow on some tests`
- WRONG\_ON\_HIDDEN: `Wrong answer on some tests`
- WRONG\_ON\_SAMPLE: `Failed a sample test`
- CRASH: `Runtime error`
- SYNTAX\_ERROR: `Syntax error`
- NOT\_SUBMITTED: `Never submitted`
- empty: no label

**Flag labels:**

- RISKY\_RUNTIME: `Close to the time limit`
- MANY\_FAILED\_SUBMITS: `Many failed submits`
- BLIND\_SUBMITS: `Submitted without running`
- SLOW\_START: `Slow first run`

**Next round card:** the `nextRound.reason` text, then the suggested questions (Q n, topic, difficulty) and the duration. Button `Create this round` calls E6 with `{ slots: nextRound.slots, durationMin: nextRound.durationMin }`.

- On 201, go to /rounds/:newId.
- On 422, show the same short-group message as S5.
- On 409 READY\_LIMIT\_REACHED, show the banner.

**Actions:** Print (calls window.print; a print stylesheet hides the buttons) and Back to my rounds.

**Removed:** percentiles, `Beats X%`, grade subtitles, `+14 min gain`, insight cards the server did not produce, Export Summary, tags that are not flags, problem names in brackets, solve times such as `Solved @ 30m`, and pass and fail counts that the API does not give.

**Acceptance:**

- Every sentence on the page comes from the API or from a label in this section.
- No code, statements, or test numbers appear.
- A round with no submissions shows Needs work and the fallback headline.
- The time map matches each `activeMinutes` list.
- Create this round works from start to finish.

## 5. Limits file

All these numbers live in one file, `src/config/limits.js`. Nothing else in the frontend may contain them (FR26). They must match the backend's `config/limits.js`.

| Name | Value | Used in |
| --- | --- | --- |
| MIN\_QUESTIONS | 1 | S5 |
| MAX\_QUESTIONS | 5 | S5 |
| DEFAULT\_QUESTIONS | 3 | S5 |
| MIN\_DURATION\_MIN | 5 | S5 |
| MAX\_DURATION\_MIN | 180 | S5 |
| SUGGESTED\_MINUTES | easy 12, medium 20, hard 30 | S5 |
| RUN\_COOLDOWN\_MS | 3000 | S9 |
| SUBMIT\_COOLDOWN\_MS | 5000 | S9 |
| MAX\_RUNS | 30 | S8, S9 |
| MAX\_SUBMITS | 20 | S8, S9 |
| MAX\_CODE\_CHARS | 51200 | S8 |
| MAX\_READY\_ROUNDS | 20 | S5 |
| AUTOSAVE\_DEBOUNCE\_MS | 1500 | S8 |
| PRE\_DEADLINE\_SAVE\_SECONDS | 15 | S8 |
| WARNING\_SECONDS | 300 | S8 |
| PAGE\_SIZE | 10 | S6 |
| WORKSPACE\_MIN\_WIDTH\_PX | 1100 | S8 |
| NAME\_MIN, NAME\_MAX | 2, 50 | S3 |
| EMAIL\_MAX | 254 | S3 |
| PASSWORD\_MIN\_BYTES, PASSWORD\_MAX\_BYTES | 8, 72 | S3 |

**FR27.** Topics are not in this file. They come only from E5.

## 6. Environment

- `VITE_API_BASE_URL`: the backend address, for example `http://localhost:5000` (the backend's default PORT).
- In the backend `.env`: `CORS_ORIGIN=http://localhost:5173` (Vite's default address).
- Nothing secret goes into the frontend. Variables starting with VITE\_ are visible to anyone who opens the browser.

## 7. Decisions

| # | Decision |
| --- | --- |
| FD1 | DESIGN.md is the visual authority. Where the design files disagree with it, follow DESIGN.md. |
| FD2 | Features the backend does not support are not built, not even as disabled controls. Ideas for later go in a 'Future ideas' section of the README. |
| FD3 | Confirm password is kept as a browser-only check. The honor-code checkbox is removed. |
| FD4 | The password strength bar is replaced by a checklist of the real rules. |
| FD5 | Reset Code is removed. It is a frontend-only feature and can come back later. |
| FD6 | Start always goes through the round details page (S7). No screen starts a round directly. |
| FD7 | Show/hide password toggles are kept. They are browser-only and harmless. |
| FD8 | The workspace needs at least 1100 px of width. Narrower screens show a notice. |
| FD9 | A question's title is shown only after it has been opened. Tabs show topic and difficulty before that. |
| FD10 | Limits live in src/config/limits.js. Topics come from E5 at runtime. |
| FD11 | The token is stored in localStorage. This is a known MVP trade-off: a script injected into the page could read it. The backend uses access tokens only (D46). |
| FD12 | The code editor is Monaco with Python only. There is no language choice. |
| FD13 | The dashboard can start a READY round. Delete happens only on My rounds (S6) and the round details page (S7). |
| FD14 | Autosave: a 1.5-second debounce, immediate saves in the last 15 seconds, and saves only when the code has changed. |
| FD15 | The report's print output is the browser's print dialog. There is no export feature. |

## 8. Build phases

Build one phase at a time. Each phase ends when its acceptance checks pass against the running backend, not only in tests.

### Before any frontend phase

1. The two backend spec fixes are made and copied into this project's docs folder: the Submit verdict backticks in section 4.5, and `serverTime` on the Run response (E14).
2. The backend phases needed by the frontend phase are finished, as listed below.

| Frontend phase | Needs backend phases |
| --- | --- |
| F0 | none (E1 is optional) |
| F1 | 2 (auth) |
| F2 | 4 (question bank, for E5) and 5 (round builder, for E6, E7) |
| F3 | 5 (E8, E9, E10) |
| F4 | 6 (round engine: E11, E12, E13) |
| F5 | 7 (Run and Submit) |
| F6 | 8 (report) |
| F7 | all |

### F0: Setup

- **Build:** the Vite React project; Tailwind v3 with the DESIGN.md tokens; fonts and icons; React Router with the routes in section 2; the API client (FR7 to FR10); the environment variable; limits.js; the auth context and route guards (FR2 to FR6, FR23, FR24); the app shell (sidebar and top bar); the public header.
- **Done when:** the app starts; every route shows a placeholder; the guards send users to the right place; a stored token is validated with E4 on start.
- **Acceptance:** FR2 to FR7, FR23, FR24 each have a test. No colour or font is used that is not in DESIGN.md (FR21).

### F1: Public pages and auth

- **Build:** S1, S2, S3.
- **Done when:** register, login and logout work against the backend.
- **Acceptance:** every error in S2 and S3 is shown correctly, using a real backend response. No banner shows on load. Passwords are not pre-filled. The password byte rule is tested with a multi-byte character.

### F2: Round builder, rounds list, dashboard

- **Build:** S4 (with the lists and counts only), S5, S6.
- **Done when:** a round can be created, a 422 is highlighted, and the rounds list pages and filters.
- **Acceptance:** stat cards match E7 totals. Topics come only from E5. Delete asks first and removes the row only after 204.

### F3: Round details

- **Build:** S7, and the round router (FR15).
- **Done when:** Start opens the workspace, and routing by status works from every entry point.
- **Acceptance:** Start twice in two tabs gives the route-away result. ACTIVE\_ROUND\_EXISTS shows its link. Delete works.

### F4: Workspace

- **Build:** S8 (countdown, question tabs, opening, editor, autosave, Finish, expiry). Run and Submit buttons are present but wired in F5.
- **Done when:** a question can be opened, edited, saved, switched, finished, and expired without a click.
- **Acceptance:** the countdown matches the server with a skewed clock. Refresh keeps the code and the deadline. The autosave flush on switching works. E12 is called once per question. Expiry leads to the report.

### F5: Run and Submit

- **Build:** S9 and the Run and Submit buttons in S8.
- **Done when:** all four Submit outcomes and all Run outcomes display correctly.
- **Acceptance:** cooldowns match the backend. Counters update from responses. A RUNNER\_UNAVAILABLE response leaves the counter unchanged. Inspecting the network responses shows that no hidden data reaches the browser (FR20).

### F6: Report

- **Build:** S10 with time map, insights, question table, next round, and print.
- **Done when:** every grade, a fallback headline, and Create this round all work against the backend.
- **Acceptance:** section 4 S10 acceptance checks pass.

### F7: Polish and checks

- **Build:** loading, empty and error states on every screen (FR22); the not-found view; the width notice (FD8); keyboard and focus basics; a search of the code for removed features and forbidden text.
- **Done when:** the removed-feature list in each screen is absent, and every state has been seen at least once.
- **Acceptance:** a README with run instructions, the environment variables, and a 'Future ideas' section.

## 9. Testing

- **Unit (Vitest):** the clock offset and remaining-time maths (FR11 to FR13); the autosave debounce and the pre-deadline rule; error normalization, including COOLDOWN seconds; label maps; the password byte rule; the default duration rule.
- **Component (React Testing Library):** S2 errors; S3 checklist and mismatch; S5 validation and 422 highlighting; S9 for each Run and Submit variant; S10 tone and time map.
- **Manual, against the running backend:** at the end of each phase, run the phase's acceptance checks in a browser.
- **Hidden data check:** read the network responses for each screen and confirm that no test data or test count appears (FR20).

## 10. Known gaps

- The design files still show features this spec removes. They are a layout guide only. Where they disagree with this spec, this spec wins.
- The Run response `serverTime` and the exact shape of `timeMap` must match the backend spec. If the backend differs, fix the backend spec first, then this spec.
