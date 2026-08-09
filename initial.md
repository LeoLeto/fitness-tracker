Build a Simple Weight & Calorie Tracking Web App

Build a production-ready, lightweight web app for tracking my body weight, calorie intake, and related daily data so I can determine my real-world maintenance calories and adjust toward a controlled lean bulk.

Core goal

I want to:

1.  Quickly enter my daily data from my phone.
2.  Track body weight and calorie intake over time.
3.  See smoothed trends rather than being misled by daily fluctuations.
4.  Compare calorie intake against weight trends.
5.  Eventually estimate my real-world maintenance calories.
6.  Target approximately \+0.2 kg/week of weight gain.
7.  Export my raw data in a format that I can easily paste into ChatGPT or upload/import for analysis.

The app should be intentionally simple. This is not a general-purpose fitness/social app.

Tech stack

Use:

- React
- TypeScript
- Vite
- SCSS modules or regular SCSS classes (NO Tailwind)
- MongoDB
- Node.js backend/API
- Prefer a simple Express backend unless there is a strong reason to use something else
- MongoDB connection via environment variable:  
    MONGODB\_URI

Keep the architecture straightforward and easy to deploy.

The application should be deployable as a standard Node/React application with minimal infrastructure.

Avoid unnecessary dependencies.

User profile

The app should have a basic profile/settings page containing:

- Sex
- Age
- Height (cm)
- Current goal
- Target weekly weight change
- Current estimated maintenance calories
- Optional notes

Initial profile values:

- Sex: Male
- Age: 30
- Height: 169 cm
- Target weight gain: 0.2 kg/week
- Training: Gym 4–5 days/week
- Cardio: None

These should be editable.

Do NOT hard-code these values into calculations. Store them in the database.

Daily tracking

The primary screen should make entering today’s data extremely fast.

Required fields:

Date

Default to today.

Allow selecting another date.

Body weight

- kg
- Decimal precision to at least 0.1 kg
- Required for a daily entry, but allow a day to exist without a weight measurement.

Calories

- Total calories consumed
- Integer
- Required if I want to record a nutrition day, but should be possible to save a weight-only entry.

Protein

- grams
- Optional

Carbohydrates

- grams
- Optional

Fat

- grams
- Optional

Bowel movement

Include a simple optional field:

- No
- Yes

This is useful because bowel contents can contribute to short-term weight fluctuations.

Do NOT treat this as a health/medical tracker. It is simply a contextual variable for interpreting body-weight fluctuations.

Notes

Free-text field.

Examples:

- Ate very salty food
- Restaurant meal
- Poor sleep
- Travel
- Very high carb day
- Missed gym
- unusually large meal
- etc.

Training tracking

Allow me to optionally record whether I trained that day.

Fields:

- Training: Yes / No
- Session type: optional text
- Duration: optional minutes

I don’t need a detailed workout tracker.

The purpose is simply to provide context when analyzing weight and calorie trends.

Daily entry UX

The daily entry page should be extremely fast to use on mobile.

Ideal workflow:

Open app → today’s date is selected → enter:

Weight: 63.7  
Calories: 2015  
Protein: 145  
Training: Yes

→ Save.

It should take less than 30 seconds.

Use large, mobile-friendly numeric inputs.

Remember the last-used values where appropriate, but do NOT accidentally carry today’s weight/calories into tomorrow’s saved record.

Provide obvious confirmation after saving.

Allow editing previous days.

Weight measurement conditions

I don’t always have a bowel movement before weighing myself.

Therefore, DO NOT require:

- bowel movement
- fasting status
- exact measurement time

However, allow optional fields:

- Time weighed
- Before food/drink: Yes/No
- After bowel movement: Yes/No

These should be optional.

The app must never invalidate a measurement because these fields are missing.

Dashboard

The main dashboard should show:

Current weight

Latest recorded weight.

7-day average

Calculate from available weight measurements.

Do not require exactly 7 measurements.

If only 4 measurements exist in the last 7 days, calculate the average from those 4.

Clearly show:

7-day average: 63.8 kg (4 measurements)

14-day average

Same principle.

28-day average

Same principle.

Weight trend

Calculate a trend/slope over the selected period.

Show:

- kg/week
- optionally grams/week

Example:

Trend: +0.17 kg/week

Target

Show:

Target: +0.20 kg/week

Then indicate whether the current trend is:

- Below target
- On target
- Above target

Use sensible tolerance rather than requiring exactly 0.200 kg/week.

For example:

- Below: < +0.10 kg/week
- On target: +0.10 to +0.30 kg/week
- Above: > +0.30 kg/week

Make these thresholds configurable later.

Calorie dashboard

Show:

- Average calories over last 7 days
- Average calories over last 14 days
- Average calories over last 28 days

Also show:

- Average protein
- Average carbs
- Average fat

Only calculate these averages from days where the relevant data exists.

Do not treat missing data as zero.

For example:

If calories are recorded on 10 of the last 14 days, say:

Average calories: 2,043 kcal (10 recorded days)

rather than silently averaging missing days as zero.

Charts

Use a lightweight charting library such as Recharts.

Create:

Weight chart

X-axis:  
Date

Y-axis:  
Weight kg

Show:

- Raw weight measurements as points
- 7-day moving average
- Optional 14-day moving average

The raw data should remain visible so I can understand the fluctuations.

Calories chart

Show daily calorie intake.

Overlay the average calorie line for the selected period.

Combined chart

Create an optional chart where:

- Weight is displayed on the primary Y-axis
- Calories are displayed on a secondary Y-axis

This helps visually compare calorie intake with weight changes.

Do not make charts visually overwhelming.

Date ranges

Allow quick selections:

- 7 days
- 14 days
- 28 days
- 3 months
- 6 months
- 1 year
- Custom

Default: 28 days.

Weight trend calculation

Do NOT simply compare the first and last weight measurement.

Use a statistically sensible trend calculation.

Prefer linear regression over the selected period.

Return:

- slope in kg/day
- slope in kg/week

Example:

If the regression slope is:

0.000028 kg/day

display:

\+0.20 kg/week

The calculation should use the actual measurement dates.

Document the calculation in code.

Maintenance calorie estimation

Create a separate "Analysis" section.

The app should attempt to estimate maintenance calories based on:

- Average calorie intake
- Weight trend
- Time period

Use the approximate relationship:

1 kg body mass ≈ 7,700 kcal

For example, if:

Average intake = 2,300 kcal/day

Weight trend = +0.2 kg/week

Estimated weekly surplus ≈ 1,540 kcal

Estimated daily surplus ≈ 220 kcal/day

Estimated maintenance ≈ 2,080 kcal/day

Clearly label this as an estimate, not a physiological measurement.

The calculation should become more reliable as more data accumulates.

Do not display an overly precise number like:

Maintenance = 2,083.47 kcal

Instead display something like:

Estimated maintenance: ~2,080 kcal/day

Also show:

- Data period used
- Number of calorie-recorded days
- Number of weight measurements
- Estimated weight trend
- Average calorie intake

If insufficient data exists, say:

Not enough data yet. Aim for at least 2–3 weeks of reasonably consistent data.

Recommended calorie target

Based on the estimated maintenance and target weight gain, calculate a suggested intake.

For a target of +0.2 kg/week:

Target surplus ≈ 220 kcal/day

Then:

Suggested intake = estimated maintenance + target surplus

But don’t blindly change the target every day.

Create a "Current calorie target" setting that I can manually override.

Example:

Estimated maintenance: ~2,080 kcal  
Target gain: +0.20 kg/week  
Suggested intake: ~2,300 kcal/day

Allow me to accept or manually modify the target.

Adjustment recommendations

Create a simple rules-based recommendation.

For example:

If:

weight trend < +0.10 kg/week

recommend:

Consider increasing intake by ~100–150 kcal/day.

If:

weight trend between +0.10 and +0.30 kg/week

recommend:

Current rate of gain looks appropriate. Keep intake unchanged.

If:

weight trend > +0.30 kg/week

recommend:

Consider reducing intake by ~100–150 kcal/day.

IMPORTANT:

The app should NOT make adjustments based on a single week’s data.

Require sufficient data, preferably:

- At least 14 days of data
- At least 8 weight measurements
- Reasonably consistent calorie tracking

Clearly explain when there isn’t enough data.

Weekly review

Create a "Weekly Review" page.

For each week display:

- Average weight
- Number of weigh-ins
- Average calories
- Number of calorie-recorded days
- Average protein
- Weight trend
- Difference from previous week’s average
- Training days
- Notes

Example:

Week of Aug 3

Average weight: 63.82 kg  
Weigh-ins: 5  
Average calories: 2,214 kcal  
Calorie days: 7  
Protein: 147 g/day  
Training days: 4  
Change vs previous week: +0.16 kg

This should make it easy to identify whether I’m actually gaining at the desired rate.

Data export — VERY IMPORTANT

The export functionality is one of the most important features.

I want to be able to easily send my data to ChatGPT for analysis.

Provide:

CSV export

Export all daily records to CSV.

Columns should include:

date

weight\_kg

calories

protein\_g

carbs\_g

fat\_g

bowel\_movement

weighed\_time

before\_food

after\_bowel\_movement

trained

training\_type

training\_duration\_min

notes

Use ISO dates:

2026-08-09

Use consistent decimal formatting.

Do not export internal MongoDB IDs unless necessary.

ChatGPT-friendly export

Also provide a second export format specifically designed for copying into ChatGPT.

Generate a clean Markdown table:

\| Date \| Weight (kg) \| Calories \| Protein \| Carbs \| Fat \| BM \| Training \| Notes \|

\|---\|---:\|---:\|---:\|---:\|---:\|---\|---\|---\|

\| 2026-08-03 \| 63.7 \| 2140 \| 145 \| 250 \| 65 \| Yes \| Yes \| Normal day \|

\| 2026-08-04 \| 63.9 \| 2210 \| 150 \| 260 \| 67 \| No \| Yes \| \|

Include a summary above the table:

Period: 2026-07-13 to 2026-08-09

Average calories: 2,143 kcal/day

Average weight: 63.92 kg

Weight trend: +0.12 kg/week

Weight measurements: 22

Calorie-recorded days: 28

Training days: 16

This should be copyable with one button:

Copy for ChatGPT

Also provide:

Download CSV

and:

Download JSON

ChatGPT analysis prompt

Even better, provide a button:

Copy Data + Analysis Prompt

which copies something like:

I'm tracking my calories and body weight to determine my real-world maintenance calories and target a weight gain of approximately 0.2 kg/week.

My profile:

\- Sex: Male

\- Age: 30

\- Height: 169 cm

\- Training: Gym 4–5x/week

\- Cardio: None

\- Target gain: 0.2 kg/week

Analyze the following data.

Please:

1. Calculate average calorie intake.

2. Calculate average weight.

3. Calculate 7-day and 14-day weight averages.

4. Estimate the weight trend in kg/week using regression.

5. Estimate my actual maintenance calories from calorie intake and weight trend.

6. Tell me whether my current intake is likely maintenance, deficit, or surplus.

7. Recommend a calorie target for approximately +0.2 kg/week.

8. Point out any data-quality issues or unusual fluctuations.

9. Don't overreact to individual weigh-ins.

10. Give me a concise recommendation for what calories I should eat for the next 1–2 weeks.

Here is my data:

\[DATA\]

Then append the Markdown table.

This feature is a major priority.

Database model

Use MongoDB.

Suggested collection:

daily\_entries

Example document:

\{

 date: "2026-08-09",

 weightKg: 63.4,

 calories: 2150,

 proteinG: 145,

 carbsG: 260,

 fatG: 65,

 bowelMovement: true,

 weighedTime: "07:42",

 beforeFood: true,

 afterBowelMovement: false,

 trained: true,

 trainingType: "Upper",

 trainingDurationMin: 70,

 notes: "Normal day",

 createdAt: Date,

 updatedAt: Date

\}

Enforce one daily entry per date.

If I save the same date again, update the existing record rather than creating duplicates.

Profile model

Example:

\{

 sex: "male",

 age: 30,

 heightCm: 169,

 targetWeightChangeKgPerWeek: 0.2,

 trainingDaysPerWeek: 4.5,

 cardio: false,

 calorieTarget: null,

 createdAt: Date,

 updatedAt: Date

\}

Design this so it can support multiple users in the future, but don’t build authentication unless necessary.

If authentication is omitted, clearly document that the deployment is intended for a private/personal instance.

API

Create a clean REST API.

Example endpoints:

GET /api/profile

PUT /api/profile

GET /api/entries

GET /api/entries/:date

POST /api/entries

PUT /api/entries/:date

DELETE /api/entries/:date

GET /api/analytics

GET /api/export/csv

GET /api/export/json

GET /api/export/chatgpt

Support date-range parameters:

GET /api/entries?from=2026-07-01&to=2026-08-09

Keep analytics calculations server-side where sensible, but it’s fine for simple UI calculations to happen client-side.

UI design

Make it clean and functional rather than flashy.

Prioritize:

- Mobile-first
- Fast data entry
- Excellent readability
- Minimal clicks
- Responsive desktop layout
- Dark/light mode if easy
- Clear charts
- No unnecessary animations

Navigation:

Dashboard

Log

History

Weekly Review

Analysis

Export

Settings

On mobile, use a simple bottom navigation or compact navigation menu.

Important data principles

1.  Never delete raw data when calculating averages or trends.
2.  Keep raw measurements exactly as entered.
3.  Never replace weight measurements with moving averages.
4.  Missing data must remain missing—not zero.
5.  Analytics should always state how much data was used.
6.  Don’t make conclusions from insufficient data.
7.  Don’t overreact to one unusual weigh-in.
8.  Use actual dates when calculating trends.
9.  Preserve historical data even if profile settings change.
10. Export must contain the raw daily data.

Testing

Include tests for the most important calculations.

At minimum test:

Moving average

Given:

63.4

64.8

63.7

63.4

64.2

calculate the correct average.

Regression

Verify the weight trend calculation uses dates correctly.

Maintenance calculation

Given:

- Average intake = 2,300 kcal
- Weight gain = 0.2 kg/week

Estimated maintenance should be approximately:

2,080 kcal/day

Missing values

Verify that missing calorie days are excluded from calorie averages.

Duplicate dates

Saving the same date twice should update rather than duplicate.

Insufficient data

Analytics should clearly report insufficient data instead of generating misleading recommendations.

Deployment

The app should be easy to deploy.

Provide:

- .env.example
- README
- MongoDB setup instructions
- Local development instructions
- Production build instructions
- Deployment instructions

Environment variables should include at minimum:

MONGODB\_URI=

PORT=

If frontend and backend require separate environment variables, document them clearly.

Make sure MongoDB connection handling is production-safe and does not create a new connection for every request.

Security

Since this is intended primarily as a private personal app:

- Do not expose MONGODB\_URI to the frontend.
- Keep MongoDB credentials server-side.
- Validate API input.
- Sanitize/validate dates and numeric values.
- Add reasonable error handling.
- Do not log sensitive environment variables.
- Do not include MongoDB credentials in exports.

Authentication is optional for v1, but structure the backend so authentication can be added later.

Code quality

Use:

- Strict TypeScript
- Clear types/interfaces
- Reusable components
- Reusable analytics functions
- No any unless absolutely necessary
- Sensible folder structure
- Comments for non-obvious calculations
- Environment-based configuration

Suggested structure:

/

├── client/

│ ├── src/

│ │ ├── components/

│ │ ├── pages/

│ │ ├── hooks/

│ │ ├── services/

│ │ ├── types/

│ │ ├── utils/

│ │ └── styles/

│ └── ...

│

├── server/

│ ├── src/

│ │ ├── models/

│ │ ├── routes/

│ │ ├── services/

│ │ ├── analytics/

│ │ ├── utils/

│ │ └── index.ts

│ └── ...

│

├── .env.example

├── README.md

└── package.json

SCSS should use a consistent naming convention.

Do NOT use Tailwind.

Definition of done

The project is complete when I can:

1.  Run it locally.
2.  Enter today’s weight and calories in under 30 seconds.
3.  Edit previous days.
4.  See raw weight and smoothed weight trends.
5.  See calorie averages.
6.  See estimated weekly weight change.
7.  See an estimated maintenance calorie number when enough data exists.
8.  See a recommended calorie target for ~0.2 kg/week gain.
9.  See weekly summaries.
10. Export CSV.
11. Copy a clean Markdown dataset.
12. Copy the dataset + an analysis prompt directly into ChatGPT.
13. Deploy the application by supplying only my MongoDB URI and other documented environment variables.

Before finishing, run the test suite, fix any failures, and provide a concise README explaining:

- How to install
- How to run locally
- How to configure MongoDB
- How to build
- How to deploy
- How the maintenance-calorie calculation works
- How the weight trend calculation works
- How to export data for ChatGPT