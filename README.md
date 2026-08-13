# Fitness Tracker

A lightweight personal web app for tracking body weight, calorie intake and
gym workouts, estimating real-world maintenance calories, and steering a
controlled lean bulk (default target: **+0.2 kg/week**).

- **Frontend:** React + TypeScript + Vite + SCSS modules + Recharts
- **Backend:** Node.js + Express + Mongoose (MongoDB)
- **Tests:** Vitest (analytics calculations)

> **Private personal instance.** There is no authentication in v1 — deploy it
> somewhere private (localhost, home network, VPN, or behind a reverse-proxy
> with auth). The backend is structured so per-user auth can be added later
> (profiles and entries are normal collections; add a `userId` field + auth
> middleware).

---

## Quick start

### 1. Prerequisites

- Node.js ≥ 20
- A MongoDB instance — either:
  - **Local:** install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and start it (defaults to `mongodb://127.0.0.1:27017`), or
  - **Hosted:** create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and copy its connection string.

### 2. Install

```bash
npm install          # installs root, client/ and server/ workspaces
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/fitness-tracker` or an Atlas `mongodb+srv://…` URI. Server-side only — never exposed to the frontend. |
| `PORT` | no (default `3001`) | Port for the Express server. |
| `NODE_ENV` | no | Set to `production` in production. |

The frontend needs **no** environment variables: in development Vite proxies
`/api` to the server; in production the server serves the built client itself.

### 4. Run locally (development)

```bash
npm run dev
```

- API server: http://localhost:3001 (restarts on change)
- Web app: http://localhost:5173 (Vite dev server, hot reload)

Open http://localhost:5173, go to **Log**, and enter today's weight/calories.

### 5. Tests

```bash
npm test
```

Covers: moving averages, date-aware regression, the maintenance-calorie
formula, missing-value handling (never averaged as zero), duplicate-date
upserts, insufficient-data reporting, meal accumulation and partial-macro
handling, partial-update (`PATCH`) semantics, food-portion scaling, meal
templates (each of the plan's five meals is asserted against its stated
total), decimal input with either separator, the workout notation parser
(including the `*`/`?`/🚨/⬆️⬇️ subtleties), strength metrics, and the
insight rules.

### 6. Production build & deploy

```bash
npm run build        # builds client/dist and server/dist
NODE_ENV=production npm start
```

`npm start` runs the compiled Express server, which serves both the API and
the built React app on `PORT` — a single Node process is the whole deployment.

**Deploying anywhere (VPS, Railway, Render, Fly.io, …):**

1. Provide `MONGODB_URI` (and optionally `PORT`) as environment variables.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`

MongoDB connection handling is production-safe: one shared mongoose
connection (with pooling) is opened at startup — never per request — and the
process exits with a clear error if the database is unreachable. Connection
strings and credentials are never logged, sent to the frontend, or included
in exports.

---

## Using the app

| Page | What it does |
|---|---|
| **Dashboard** | Current weight, 7/14/28-day averages (with measurement counts), weight trend vs target, calorie & macro averages, this week's training, weight/calorie/combined charts, quick date ranges (7d…1y, custom). |
| **Weigh-in** | Body weight plus the previous weigh-in and day-over-day delta, with the optional weigh-in conditions (time weighed + "Now" button, before food, after bowel movement) always expanded — no taps to reach them. |
| **Food** | Meal-by-meal logging that accumulates the day: each meal has a label (auto-suggested from labels used before), optional time, calories and optional protein/carbs/fat/fiber. The running day total is shown against your calorie target with the amount remaining. **Quick add** logs from the food library in one tap — a whole meal template, every meal of the day at once, or a single food at one of its usual portions — and saves it immediately, with a 5-second **Undo** in the toast. Meals already eaten stay **folded behind their count** (tap to edit) and every save returns you to the day total at the top. A day can also be logged as one total, and an existing total can be split into meals without losing the number. |
| **Food library** | Reusable foods and meal templates. A food stores its nutrition per a reference amount (per 100 ml, per 1 egg, per 50 g) plus the portions worth a one-tap button, so any quantity scales correctly. Templates are lists of foods with quantities, and both their totals and their written-out recipe are computed from the library — editing a food updates every template that uses it. |
| **Train** | Workout logger: pick a routine (Push/Pull/Legs/Abs/Cardio), log sets with one-tap RIR (0–4) and flag chips, **ghosts of the last session** (its weight/reps/RIR shown inside the empty fields, set by set) plus each exercise's **all-time PR and a live "new PR" flag**, copy the last session with one tap, reorder exercises with ↑↓ (order swaps are recorded automatically), per-exercise "quick text" entry in your own notation, cardio sessions (type + minutes), and an exercise manager (setup notes, bodyweight flag, ordering, archive). |
| **Exercise progress** | Per-exercise chart of estimated 1RM (or best reps for bodyweight work) over real calendar time, with pain/form-flagged sessions marked, plus a session table. |
| **History** | All entries — tap a day to edit its weigh-in, tap the calorie figure to edit its food, or delete the day. |
| **Weekly Review** | Monday–Sunday summaries: average weight, weigh-ins, calories, protein, within-week trend, change vs previous week, training days, sessions per routine, cardio minutes, notes. |
| **Analysis** | **Body & Training timeline** (three date-aligned panels: weight with energy-balance bands + event markers, strength index per routine, weekly sessions stacked by routine + cardio), **Insights** (detected events and periods), maintenance-calorie estimate, suggested intake, rules-based recommendation, and a manually controlled "current calorie target". |
| **Export** | CSV / JSON downloads for daily data, meals **and** workouts, one-tap "Copy for ChatGPT" (Markdown summary + tables + workout log) and "Copy Data + Analysis Prompt". |
| **Settings** | Profile (sex, age, height, goal, target kg/week, training, cardio, notes), calorie target, theme (auto/light/dark). Stored in the database — nothing is hard-coded into calculations. |

### Workout set notation

Sets are stored structurally but can be typed (and are exported) in the
compact notation used in the original paper logs:

```
90 x7 (2 RIR) x7 (1 RIR) x8* (0 RIR); 80 x6?
```

- weight, then `xReps` per set — a new number starts a new weight group
- `(n RIR)` — reps in reserve · `*` — last rep with bad form
- `?` — rep count uncertain · `🚨` — set cut short because of pain
- `BW` — bodyweight · `DS35x3/30x3` — drop set
- ⬆️/⬇️ badges mean the exercise order was swapped that day (recorded
  automatically when you reorder exercises in the logger)

### Insights (rules-based, always transparent about data used)

- **Energy-balance bands** — each week is classified by the regression trend
  of the trailing 28 days of weigh-ins (steep deficit ≤ −0.35 kg/wk, deficit,
  maintenance, surplus, steep surplus ≥ +0.35), and consecutive weeks merge
  into labeled bands. Inside every band the app measures per-routine strength
  change (first vs last e1RM of each exercise with ≥3 sessions) — this makes
  patterns like *"strength dipped during the steep cut"* visible.
- **Training gaps** — a routine untrained ≥21 days produces a "resumed after
  N days" event.
- **Fluid-retention spikes** — if body weight jumps ≥1 kg within 10 days of a
  routine resuming (vs the prior 7-day average), the app flags it as likely
  intramuscular fluid/glycogen, not fat — most visible with large muscle
  groups like legs.
- **Recurring pain** — ≥2 pain-flagged (🚨) sessions of the same exercise
  within 45 days.

### Importing historical paper logs

`npm run import:raw -w server [-- "path" [year]]` parses the Markdown files
in `raw workout data/` (exercise headers, month headers, weekday-prefixed
session lines in the notation above) plus `Body weight.md`, infers real dates
from month + weekday sequence (imported sessions are marked *date approx.*),
and upserts everything idempotently.

### Strength metric

Estimated 1RM uses the Epley formula adjusted for reps in reserve, so
submaximal sets are comparable to sets taken to failure:

```
e1RM = weight × (1 + (reps + RIR) / 30)
```

Bodyweight exercises are tracked by the best set's `reps + RIR` instead.

**Personal bests** (`GET /api/analytics/records`) rank every set an exercise
has ever seen by that same metric: a loaded set always beats an unloaded one,
two loaded sets are compared by e1RM, two unloaded ones by effective reps. Ties
keep the earlier date, so a PR is dated when it was first reached rather than
when it was last equalled. Sets flagged for pain (🚨) or bad form (✱) stay
eligible — they happened — but the flags are shown on the record instead of
presenting it as a clean lift. While you log, the same comparison runs on the
sets in the editor, so the "new PR" flag appears while there is still time to
add another set.

### Navigation

On mobile the bottom tab bar is the entire navigation — Home, Weigh, Food,
Train, Stats, More — with no header or branding taking up vertical space.
History, Food library, Weekly Review, Export and Settings live under **More**.
On desktop (≥820px) a single top nav row replaces the tabs. A floating ↑ button
appears once a page is scrolled past 400px, on any page.

### The food library

Foods store nutrition **per a reference amount** and are scaled on demand, so
one entry covers every portion size:

| Food | Stored as | One-tap portions |
|---|---|---|
| Skimmed milk | 31 kcal / 3.2 P / 5 C per 100 ml | 200 ml (62 kcal), 300 ml (93 kcal) |
| Eggs | 70 kcal / 5 P per egg | 3 (210 kcal), 4 (280 kcal) |
| TSP (dry) | 200 kcal / 25 P / 18 C / 9 fib per 50 g | 50 g |
| Chicken (raw) | 120 kcal / 20 P per 100 g | 150 g (180 kcal) |

Tapping a portion logs a meal straight away — no scrolling down to save — and
the toast offers **Undo** for 5 seconds. Tapping a food's name opens a
custom-amount box that scales the same way. Meal templates group foods into a
named meal (e.g. *04:15 TSP + Apple + Potato*) and log the whole thing in one
tap, with **Add all N meals** logging a planned day at once. The one exception
is a day logged as a single total: quick-adding there would throw that number
away, so it still asks for an explicit save.

Each template lists its recipe under the name — every quantity with its unit
plus the food's own note (*50 g TSP (dry) · 200 ml Skimmed milk · 180 g Apple ·
200 g Potato (raw)*) — so the same row you tap to log is the reference while
you prepare the meal. The breakdown comes from the API (`parts` on a resolved
template), computed from the current library, so it can never drift from the
totals beside it.

`npm run seed:foods -w server` seeds the library and templates from the
maintenance plan (idempotent — foods upsert by name, templates by name).
Macros the plan doesn't state are left blank rather than invented, so a day's
fat total honestly reports partial coverage until you fill them in.

### How meals and day totals relate

A day's calories and macros are a **single source of truth**: whenever a day
has meals, its totals are derived from them server-side, so every average,
trend and export stays consistent no matter where the data was entered.
Macros (protein, carbs, fat, fiber) sum only over the meals that recorded them
and the UI says so (e.g. "F 18 g · 1/2 meals") rather than silently
under-reporting; a macro no meal recorded stays missing instead of becoming
zero. Days logged before meals existed (or entered as one number) keep working
exactly as they did.

Because the weigh-in and food screens are separate, each one saves only its
own fields via `PATCH /api/entries/:date` — logging a weigh-in never touches
that day's meals, and vice versa.

### Data principles

Raw measurements are stored exactly as entered and never replaced by smoothed
values. Missing data stays missing (never treated as 0), every average
reports how many data points produced it, and no conclusions are drawn from
insufficient data.

---

## How the calculations work

### Weight trend (`server/src/analytics/trend.ts`)

Ordinary least-squares **linear regression** of weight against time — not a
first-vs-last comparison, which daily fluctuation would dominate:

```
x_i = days since first measurement (actual calendar dates)
y_i = weight (kg)
slope = Σ((x_i − x̄)(y_i − ȳ)) / Σ((x_i − x̄)²)     [kg/day]
trend = slope × 7                                   [kg/week]
```

Using real dates means uneven gaps between weigh-ins are weighted correctly.
Requires ≥ 2 measurements on different days; otherwise the app reports that
there is not enough data.

The trend is compared to your target with a ±0.10 kg/week tolerance band
(constant `TREND_TOLERANCE_KG_PER_WEEK` in
`server/src/analytics/recommendation.ts`), e.g. for a +0.20 target:
below < +0.10, on-target +0.10…+0.30, above > +0.30.

### Maintenance calories (`server/src/analytics/maintenance.ts`)

Uses the approximation **1 kg body mass ≈ 7,700 kcal**:

```
daily surplus  = trend (kg/week) × 7700 / 7
maintenance    = average intake − daily surplus     (rounded to nearest 10)
suggested      = maintenance + target surplus
```

Example: intake 2,300 kcal/day at +0.2 kg/week → surplus ≈ 220 kcal/day →
maintenance ≈ **2,080 kcal/day**, suggested intake for +0.2 kg/week ≈ 2,300.

This is an estimate, not a physiological measurement — it's displayed as
"~2,080 kcal/day", always alongside the data period, calorie-day count,
weigh-in count, trend, and average intake used to compute it.

**Estimates and recommendations are withheld until there is enough data:**
at least 14 days of span, 8 weight measurements, and 10 calorie-recorded days
(constants in `server/src/analytics/recommendation.ts`). The suggested intake
never silently changes your target — the "current calorie target" only
changes when you accept or override it in Analysis/Settings.

### Averages

7/14/28-day averages use whichever measurements exist in the window and
always display the count ("63.8 kg · 4 measurements"). Days without a value
are excluded, never counted as zero. Chart moving averages are display
smoothing only.

---

## Exporting data for ChatGPT

On the **Export** page:

- **Copy Data + Analysis Prompt** — copies a complete analysis prompt
  (including your profile from the database) followed by a Markdown table of
  raw daily data. Paste straight into ChatGPT.
- **Copy for ChatGPT** — the Markdown summary + table only.
- **Download CSV** — columns: `date, weight_kg, calories, protein_g, carbs_g,
  fat_g, fiber_g, bowel_movement, weighed_time, before_food,
  after_bowel_movement, trained, training_type, training_duration_min, notes,
  meal_count` (ISO dates, one decimal for weight, no MongoDB internals).
- **Download JSON** — the same raw records as JSON, meals included.
- **Meals CSV** — one row per logged meal: `date, meal_number, label, time,
  calories, protein_g, carbs_g, fat_g, fiber_g, notes`.

All exports default to the full history; tick "Limit to a date range" to
export a period.

---

## API

REST endpoints (all under `/api`):

```
GET    /api/profile              PUT    /api/profile
GET    /api/entries?from&to      POST   /api/entries
GET    /api/entries/:date        PUT    /api/entries/:date
PATCH  /api/entries/:date        DELETE /api/entries/:date
GET    /api/foods                POST   /api/foods
PUT    /api/foods/:id            DELETE /api/foods/:id
GET    /api/foods/templates      POST   /api/foods/templates
PUT    /api/foods/templates/:id  DELETE /api/foods/templates/:id
GET    /api/exercises?routine    POST   /api/exercises
PUT    /api/exercises/:id        DELETE /api/exercises/:id
GET    /api/workouts?from&to&routine&type
GET    /api/workouts/last?routine&before
POST   /api/workouts             POST   /api/workouts/parse
GET    /api/workouts/:id         PUT    /api/workouts/:id
DELETE /api/workouts/:id
GET    /api/analytics?from&to    GET    /api/analytics/weekly
GET    /api/analytics/strength?exercise
GET    /api/analytics/records
GET    /api/analytics/timeline?from&to
GET    /api/export/csv?from&to
GET    /api/export/json?from&to
GET    /api/export/meals.csv?from&to
GET    /api/export/workouts.csv?from&to
GET    /api/export/workouts.json?from&to
GET    /api/export/chatgpt?from&to&prompt=1&workouts=0
```

`POST`/`PUT` on an entry replace the whole day (used by the importer); `PATCH`
updates only the fields you send, which is how the Weigh and Food screens
avoid overwriting each other. Strength workouts upsert by (date, routine) —
saving the same routine on the same day updates that session.

`POST /api/entries` and `PUT /api/entries/:date` both upsert by date (unique
index on `date`), so saving a date twice updates the existing record. All
input is validated server-side (dates, numeric ranges, string lengths).

## Project structure

```
├── client/               React app (Vite)
│   └── src/
│       ├── components/   layout, fields, charts, shared UI
│       ├── pages/        Dashboard, Weigh, Food, Train, History, Weekly, Analysis, Export, Settings
│       ├── hooks/        useApi, useTheme
│       ├── services/     API client
│       ├── types/        API types
│       ├── utils/        dates, formatting, chart series
│       └── styles/       global SCSS + tokens
├── server/               Express API
│   └── src/
│       ├── models/       DailyEntry, Profile, Food, Exercise, Workout (Mongoose)
│       ├── routes/       profile, entries, foods, exercises, workouts, analytics, export
│       ├── analytics/    trend, averages, maintenance, recommendation, weekly
│       ├── workouts/     notation parser, strength metrics, insights, timeline
│       ├── scripts/      importRaw (historical notes), seedFoodLibrary
│       ├── services/     entry upsert, meal totals, food portions, export builders
│       └── utils/        validation, dates, csv
│   └── test/             Vitest suites
├── raw workout data/     original paper-log Markdown (local only, gitignored)
├── .env.example
└── README.md
```
