/**
 * One-time importer for the "raw workout data" folder:
 *
 *   - <Routine>.md files (Push/Pull/Legs/Abs …) → exercises + workouts
 *   - Body weight.md → daily entries (weigh-ins; "(G x.x)" kept as a note)
 *
 * The notes carry no explicit dates — only month headers and weekday letters
 * in chronological order — so dates are inferred greedily: each session takes
 * the first calendar date matching its weekday, inside its month, strictly
 * after the previous session. Imported workouts are marked `dateInferred`.
 *
 * Idempotent: workouts upsert by (date, routine), exercises by (name,
 * routine), and existing daily entries are never overwritten.
 *
 * Usage:  npm run import:raw -w server [-- "path/to/raw workout data" [year]]
 */
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { connectDb, disconnectDb } from '../db';
import { DailyEntryModel } from '../models/DailyEntry';
import { ExerciseModel } from '../models/Exercise';
import { WorkoutModel } from '../models/Workout';
import { isoDate } from '../utils/dates';
import { parseSessionLine } from '../workouts/notation';
import { WorkoutExercise } from '../workouts/types';

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const WEEKDAYS: Record<string, number> = { su: 0, m: 1, tu: 2, w: 3, th: 4, f: 5, sa: 6 };

const MONTH_LINE_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*:?\s*$/i;
const EXERCISE_LINE_RE = /^\*\*(.+?)\*\*\s*(.*)$/;
const SESSION_LINE_RE = /^(M|Tu|W|Th|F|Sa|Su)\s*:\s*(.*)$/;

interface RawSession {
  monthIdx: number;
  weekday: number;
  text: string;
}

interface RawExercise {
  name: string;
  setupNotes: string;
  isBodyweight: boolean;
  sessions: RawSession[];
}

const warnings: string[] = [];

function parseWorkoutFile(content: string): RawExercise[] {
  const exercises: RawExercise[] = [];
  let current: RawExercise | null = null;
  let currentMonth = 0; // sessions before any month header default to January
  let justOpenedExercise = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;

    const exMatch = line.match(EXERCISE_LINE_RE);
    if (exMatch) {
      const rawName = exMatch[1].trim();
      const isBodyweight = /\(BW\)/i.test(rawName) || /\(BW\)/i.test(exMatch[2]);
      current = {
        name: rawName.replace(/\s*\(BW\)\s*/i, ' ').trim(),
        setupNotes: exMatch[2].replace(/\\(.)/g, '$1').trim(),
        isBodyweight,
        sessions: [],
      };
      exercises.push(current);
      currentMonth = 0;
      justOpenedExercise = true;
      continue;
    }

    const monthMatch = line.match(MONTH_LINE_RE);
    if (monthMatch) {
      currentMonth = MONTHS[monthMatch[1].slice(0, 3).toLowerCase()];
      justOpenedExercise = false;
      continue;
    }

    const sessionMatch = line.match(SESSION_LINE_RE);
    if (sessionMatch && current) {
      const text = sessionMatch[2].trim();
      if (text !== '') {
        current.sessions.push({
          monthIdx: currentMonth,
          weekday: WEEKDAYS[sessionMatch[1].toLowerCase()],
          text,
        });
      }
      justOpenedExercise = false;
      continue;
    }

    if (current && justOpenedExercise) {
      // Standalone line right after the header → machine setup notes.
      current.setupNotes = [current.setupNotes, line.replace(/\\(.)/g, '$1')]
        .filter(Boolean)
        .join(' ')
        .trim();
    } else {
      warnings.push(`skipped line: "${line}"`);
    }
  }
  return exercises;
}

/**
 * Greedy date inference: first date matching the weekday, within the
 * session's month, strictly after the previous session's date.
 */
function inferDates(sessions: RawSession[], year: number): string[] {
  const dates: string[] = [];
  let cursor: Date | null = null;

  for (const s of sessions) {
    const monthStart = new Date(Date.UTC(year, s.monthIdx, 1));
    let candidate: Date =
      cursor !== null && cursor >= monthStart
        ? new Date(cursor.getTime() + 86_400_000)
        : monthStart;
    while (candidate.getUTCDay() !== s.weekday) {
      candidate = new Date(candidate.getTime() + 86_400_000);
    }
    if (candidate.getUTCMonth() !== s.monthIdx) {
      warnings.push(
        `session (weekday ${s.weekday}, month ${s.monthIdx + 1}) overflowed its month → ${isoDate(candidate)}`
      );
    }
    dates.push(isoDate(candidate));
    cursor = candidate;
  }
  return dates;
}

async function importWorkoutFile(filePath: string, year: number): Promise<void> {
  const routine = path.basename(filePath).split(/[\s.(]/)[0].toLowerCase();
  const content = fs.readFileSync(filePath, 'utf8');
  const rawExercises = parseWorkoutFile(content);

  // Catalog upserts, preserving file order.
  const exerciseIds = new Map<string, string>();
  for (let i = 0; i < rawExercises.length; i++) {
    const ex = rawExercises[i];
    const doc = await ExerciseModel.findOneAndUpdate(
      { name: ex.name, routine },
      {
        $set: {
          setupNotes: ex.setupNotes,
          isBodyweight: ex.isBodyweight,
          orderIndex: i,
          archived: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    exerciseIds.set(ex.name, String(doc._id));
  }

  // Sessions grouped by inferred date.
  const byDate = new Map<string, WorkoutExercise[]>();
  for (const ex of rawExercises) {
    const dates = inferDates(ex.sessions, year);
    ex.sessions.forEach((session, i) => {
      const parsed = parseSessionLine(session.text, { isBodyweight: ex.isBodyweight });
      for (const w of parsed.warnings) {
        warnings.push(`${ex.name} @ ${dates[i]}: ${w}`);
      }
      if (parsed.sets.length === 0) return;
      const list = byDate.get(dates[i]) ?? [];
      list.push({
        exerciseId: exerciseIds.get(ex.name) ?? null,
        exerciseName: ex.name,
        order: list.length,
        orderMoved: parsed.orderMoved,
        variation: parsed.variation,
        sets: parsed.sets,
      });
      byDate.set(dates[i], list);
    });
  }

  let saved = 0;
  for (const [date, exercisesForDay] of byDate) {
    await WorkoutModel.findOneAndUpdate(
      { date, routine, type: 'strength' },
      {
        $set: {
          date,
          type: 'strength',
          routine,
          cardioType: null,
          durationMin: null,
          notes: null,
          dateInferred: true,
          exercises: exercisesForDay,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    saved++;
  }
  console.log(
    `${path.basename(filePath)} → routine "${routine}": ${rawExercises.length} exercises, ${saved} workouts`
  );
}

const BODYWEIGHT_LINE_RE =
  /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})/i;

async function importBodyWeightFile(filePath: string, year: number): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf8');
  let created = 0;
  let skipped = 0;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;

    const dateMatch = line.match(BODYWEIGHT_LINE_RE);
    if (!dateMatch) {
      warnings.push(`body weight: unparsed line "${line}"`);
      continue;
    }
    const month = MONTHS[dateMatch[1].slice(0, 3).toLowerCase()];
    const day = Number(dateMatch[2]);
    const date = isoDate(new Date(Date.UTC(year, month, day)));

    // "(G 10.1)" side measurement → kept verbatim as the entry note.
    const gMatch = line.match(/\(G\s*([\d.]+)?/i);
    const note = gMatch?.[1] ? `G ${gMatch[1]}` : null;

    // The weight is the last decimal number outside the (G …) part.
    const withoutG = line.replace(/\(G[^)]*\)?/i, '');
    const afterDate = withoutG.slice((dateMatch.index ?? 0) + dateMatch[0].length);
    const numbers = afterDate.match(/\d{2,3}(?:\.\d+)?/g);
    if (!numbers || numbers.length === 0) {
      warnings.push(`body weight: no weight found in "${line}"`);
      continue;
    }
    const weightKg = Number(numbers[numbers.length - 1]);

    const existing = await DailyEntryModel.findOne({ date }).lean();
    if (existing && (existing as { weightKg?: number | null }).weightKg != null) {
      skipped++;
      continue;
    }
    await DailyEntryModel.findOneAndUpdate(
      { date },
      { $set: { weightKg, ...(note ? { notes: note } : {}) }, $setOnInsert: { date } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    created++;
  }
  console.log(`Body weight → ${created} weigh-ins imported, ${skipped} already present`);
}

async function main() {
  const folder = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '..', '..', '..', 'raw workout data');
  const year = process.argv[3] ? Number(process.argv[3]) : new Date().getFullYear();

  if (!fs.existsSync(folder)) {
    console.error(`Folder not found: ${folder}`);
    process.exit(1);
  }

  await connectDb(config.mongoUri);
  console.log(`Importing from ${folder} (year ${year})`);

  for (const file of fs.readdirSync(folder)) {
    if (!file.toLowerCase().endsWith('.md')) continue;
    const filePath = path.join(folder, file);
    if (/body\s*weight/i.test(file)) {
      await importBodyWeightFile(filePath, year);
    } else {
      await importWorkoutFile(filePath, year);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warnings:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  await disconnectDb();
}

void main();
