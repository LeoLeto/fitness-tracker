import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DayNav } from '../components/DayNav';
import { NumericInput } from '../components/fields';
import { ExerciseCard } from '../components/train/ExerciseCard';
import { ExerciseManager } from '../components/train/ExerciseManager';
import {
  buildWorkoutExercises,
  editorFromWorkout,
  EditorExercise,
  emptyEditorSet,
  lastByKeyFrom,
  loggedSets,
  orderMovedFor,
  withVariant,
} from '../components/train/editorTypes';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { LastPerformance, Workout } from '../types';
import { addDays, formatMedium, todayStr } from '../utils/dates';
import { parseDecimal } from '../utils/numeric';
import { perfKey } from '../utils/variants';
import {
  fmtDuration,
  paceMinPerKm,
  ROUTINE_ORDER,
  routineLabel,
  workoutSummary,
} from '../utils/workouts';
import pageStyles from '../styles/page.module.scss';
import styles from '../components/train/train.module.scss';

const LAST_ROUTINE_KEY = 'fitness-tracker-last-routine';
const DEFAULT_CARDIO_TYPE = 'treadmill';

/**
 * Long enough that a burst of taps (weight, reps, RIR) is one request, short
 * enough that putting the phone down mid-set never leaves anything unsaved.
 */
const AUTOSAVE_DELAY_MS = 900;

type SaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'error';

export function TrainPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, show } = useToast();

  const paramDate = searchParams.get('date');
  const date = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : todayStr();
  const routine =
    searchParams.get('routine') ?? localStorage.getItem(LAST_ROUTINE_KEY) ?? 'push';

  const allExercises = useApi(() => api.listExercises(), []);
  const recent = useApi(
    () => api.listWorkouts({ from: addDays(todayStr(), -60) }),
    [date, routine]
  );
  // All-time bests for every exercise: one fetch that survives routine switches.
  const records = useApi(() => api.getPersonalBests(), []);

  // Keyed by exercise *and* variant: the cable low row's record is not a
  // target on the chest-supported machine, and vice versa.
  const prByKey = useMemo(
    () => new Map((records.data ?? []).map((r) => [perfKey(r.exerciseName, r.variant), r])),
    [records.data]
  );

  const routines = useMemo(() => {
    const found = new Set((allExercises.data ?? []).map((e) => e.routine));
    const ordered = ROUTINE_ORDER.filter((r) => found.has(r));
    for (const r of [...found].sort()) if (!ordered.includes(r)) ordered.push(r);
    if (ordered.length === 0) ordered.push('push', 'pull', 'legs', 'abs');
    return ordered;
  }, [allExercises.data]);

  const setParams = useCallback(
    (next: { date?: string; routine?: string }) => {
      const params: Record<string, string> = {
        date: next.date ?? date,
        routine: next.routine ?? routine,
      };
      if (next.routine) localStorage.setItem(LAST_ROUTINE_KEY, next.routine);
      setSearchParams(params);
    },
    [date, routine, setSearchParams]
  );

  // ── Strength editor state ────────────────────────────────────────────────
  const [editor, setEditor] = useState<EditorExercise[]>([]);
  const [existing, setExisting] = useState<Workout | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [manageOpen, setManageOpen] = useState(false);

  const isCardio = routine === 'cardio';

  useEffect(() => {
    if (isCardio || allExercises.data === null) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.listWorkouts({ from: date, to: date, routine, type: 'strength' }),
      api.getLastByExercise(date),
    ])
      .then(([todays, lastRecords]) => {
        if (cancelled) return;
        const workout = todays[0] ?? null;
        const catalog = (allExercises.data ?? [])
          .filter((e) => e.routine === routine && !e.archived)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        lastByKeyRef.current = lastByKeyFrom(lastRecords);
        const next = editorFromWorkout(workout, catalog, lastRecords);
        sessionKeyRef.current = `${date}|${routine}`;
        savedPayloadRef.current = JSON.stringify(buildWorkoutExercises(next).exercises);
        setExisting(workout);
        setEditor(next);
        setOpenIndex(null);
        setSaveState('clean');
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load workout');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, routine, isCardio, allExercises.data]);

  const moved = orderMovedFor(editor);

  // ── Autosave ─────────────────────────────────────────────────────────────
  // Nothing in a gym is a good moment to remember to press Save, so every edit
  // persists on its own. A save sends the whole session, so overlapping ones
  // could land out of order: a single in-flight save at a time, with the latest
  // state re-sent afterwards if it moved on meanwhile.
  // Read through refs, not through the closure: `persist` has to keep the same
  // identity across renders or the debounce timer below is cleared and restarted
  // on every one of them, and a save in flight ends up sent twice.
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const existingRef = useRef<Workout | null>(existing);
  existingRef.current = existing;
  const savingRef = useRef(false);
  const resaveRef = useRef(false);
  /** What the server already holds, so identical state is never re-sent. */
  const savedPayloadRef = useRef<string>('');
  /**
   * The day+routine currently on screen. A save started before you swapped days
   * still completes — its response just must not be applied to the day you
   * swapped to, or "Delete this session" would point at the wrong workout.
   */
  const sessionKeyRef = useRef('');
  /**
   * Every exercise's last performance per variant, kept from the load so that
   * switching machines mid-card can re-point "last" and the ghost rows at that
   * machine's own history without another round trip.
   */
  const lastByKeyRef = useRef<Map<string, LastPerformance>>(new Map());

  const reloadRecent = recent.reload;
  const reloadRecords = records.reload;

  const persist = useCallback(async () => {
    if (savingRef.current) {
      resaveRef.current = true;
      return;
    }
    const { exercises, errors } = buildWorkoutExercises(editorRef.current);
    if (errors.length > 0) {
      setError(errors.join(' · '));
      setSaveState('error');
      return;
    }
    setError(null);
    // Clearing every set doesn't silently delete the session — "Delete this
    // session" is the deliberate way to do that.
    if (exercises.length === 0) {
      setSaveState('clean');
      return;
    }
    const payload = JSON.stringify(exercises);
    if (payload === savedPayloadRef.current) {
      setSaveState('saved');
      return;
    }

    savingRef.current = true;
    setSaveState('saving');
    const previous = existingRef.current;
    const key = `${date}|${routine}`;
    try {
      const saved = await api.saveWorkout({
        date,
        type: 'strength',
        routine,
        cardioType: null,
        durationMin: previous?.durationMin ?? null,
        distanceKm: null,
        notes: previous?.notes ?? null,
        dateInferred: false,
        exercises,
      });
      // Only the first save of a day changes the lists below — refetching 60
      // days of history after every set would be a lot of phone data for a
      // section you're not looking at.
      if (previous === null) {
        reloadRecent();
        reloadRecords();
      }
      if (sessionKeyRef.current !== key) return; // the day moved on; it's saved, that's enough
      savedPayloadRef.current = payload;
      setExisting(saved);
      setSaveState('saved');
    } catch (err) {
      if (sessionKeyRef.current !== key) return;
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaveState('error');
    } finally {
      savingRef.current = false;
      // Edits that landed mid-flight go out now; if they amounted to nothing,
      // the payload check above makes this a no-op.
      if (resaveRef.current) {
        resaveRef.current = false;
        void persist();
      }
    }
  }, [date, routine, reloadRecent, reloadRecords]);

  useEffect(() => {
    if (isCardio || loading) return;
    // Expanding a card or typing a half-set changes the editor without changing
    // what the session amounts to — comparing the payload keeps those free.
    const { exercises, errors } = buildWorkoutExercises(editor);
    if (errors.length === 0 && JSON.stringify(exercises) === savedPayloadRef.current) return;
    setSaveState((s) => (s === 'saving' ? s : 'pending'));
    const timer = window.setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [editor, isCardio, loading, persist]);

  const updateExercise = (i: number, next: EditorExercise) =>
    setEditor((list) => list.map((e, j) => (j === i ? next : e)));

  /**
   * Same movement, different machine. The sets already typed stay — switching
   * is usually a correction, or a machine given up on after a set — but the
   * numbers to beat become that machine's own.
   */
  const setVariant = (i: number, variant: string | null) =>
    setEditor((list) =>
      list.map((e, j) => (j === i ? withVariant(e, variant, lastByKeyRef.current) : e))
    );

  /**
   * Only one exercise is open at a time: you do them one after another, and a
   * screen of collapsed cards is a screen you can see the whole session on.
   * Opening one with no sets starts it off with a row ready to type into.
   */
  const toggleExercise = (i: number) => {
    setOpenIndex((current) => (current === i ? null : i));
    setEditor((list) =>
      list.map((e, j) =>
        j === i && openIndex !== i && e.sets.length === 0
          ? { ...e, sets: [emptyEditorSet()] }
          : e
      )
    );
  };

  const moveExercise = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= editor.length) return;
    const next = [...editor];
    [next[i], next[j]] = [next[j], next[i]];
    setEditor(next);
    setOpenIndex((current) => (current === i ? j : current === j ? i : current));
  };

  /**
   * A movement abandoned mid-exercise (a set hurt, a machine gave out) and
   * finished on another one. The replacement moves in directly after it, keeps
   * a link back to what it replaced, and opens ready for the next set — both
   * exercises keep exactly the sets that were actually performed.
   */
  const swapTo = (fromIndex: number, targetName: string) => {
    const from = editor[fromIndex];
    const targetIndex = editor.findIndex((e) => e.exerciseName === targetName);
    if (!from || targetIndex === -1) return;

    const target: EditorExercise = {
      ...editor[targetIndex],
      swappedFrom: from.exerciseName,
      sets:
        editor[targetIndex].sets.length > 0 ? editor[targetIndex].sets : [emptyEditorSet()],
    };

    const rest = editor.filter((_, i) => i !== targetIndex);
    const insertAt = rest.findIndex((e) => e === from) + 1;
    const next = [...rest.slice(0, insertAt), target, ...rest.slice(insertAt)];
    setEditor(next);
    setOpenIndex(insertAt);
    show(`Swapped to ${targetName}`);
  };

  const deleteWorkout = async () => {
    if (!existing?.id) return;
    if (!window.confirm(`Delete the ${routine} session for ${formatMedium(date)}?`)) return;
    await api.deleteWorkout(existing.id);
    show('Workout deleted');
    setExisting(null);
    recent.reload();
    records.reload(); // a deleted session can take a record with it
    setParams({});
  };

  // ── Cardio state ─────────────────────────────────────────────────────────
  const [cardioType, setCardioType] = useState(DEFAULT_CARDIO_TYPE);
  // Minutes and seconds apart: it's what the treadmill shows, and a phone's
  // numeric keypad has no colon to type "32:15" with.
  const [cardioMin, setCardioMin] = useState('');
  const [cardioSec, setCardioSec] = useState('');
  const [cardioDistance, setCardioDistance] = useState('');
  const [cardioNotes, setCardioNotes] = useState('');
  const [savingCardio, setSavingCardio] = useState(false);

  const cardioForDay = (recent.data ?? []).filter(
    (w) => w.type === 'cardio' && w.date === date
  );

  const minutes = parseDecimal(cardioMin);
  const seconds = parseDecimal(cardioSec);
  const distance = parseDecimal(cardioDistance);
  const duration =
    minutes === undefined || seconds === undefined || (minutes == null && seconds == null)
      ? null
      : (minutes ?? 0) + (seconds ?? 0) / 60;
  const livePace = paceMinPerKm(duration, distance ?? null);

  const saveCardio = async () => {
    if (duration == null || duration <= 0) {
      setError('Enter the time (minutes and/or seconds).');
      return;
    }
    if (seconds != null && seconds >= 60) {
      setError('Seconds must be under 60.');
      return;
    }
    if (distance === undefined || (distance != null && distance <= 0)) {
      setError('Distance must be a number of km, or left empty.');
      return;
    }
    setError(null);
    setSavingCardio(true);
    try {
      await api.saveWorkout({
        date,
        type: 'cardio',
        routine: null,
        cardioType: cardioType.trim() === '' ? 'cardio' : cardioType.trim(),
        // Four decimals is under a hundredth of a second — enough that the
        // seconds typed come back exactly.
        durationMin: Math.round(duration * 10000) / 10000,
        distanceKm: distance,
        notes: cardioNotes.trim() === '' ? null : cardioNotes.trim(),
        dateInferred: false,
        exercises: [],
      });
      show(`Run saved for ${formatMedium(date)} ✓`);
      setCardioType(DEFAULT_CARDIO_TYPE);
      setCardioMin('');
      setCardioSec('');
      setCardioDistance('');
      setCardioNotes('');
      recent.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingCardio(false);
    }
  };

  const recentSessions = [...(recent.data ?? [])]
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 8);

  const saveLabel: Record<SaveState, string> = {
    clean: '',
    pending: '• unsaved',
    saving: 'saving…',
    saved: 'saved ✓',
    error: 'not saved',
  };

  return (
    <div className={pageStyles.page}>
      <DayNav date={date} onChange={(next) => setParams({ date: next })} />

      <div className={styles.routineBar}>
        <div className={styles.routineChips} role="group" aria-label="Routine">
          {routines.map((r) => (
            <button
              key={r}
              type="button"
              className={r === routine ? `${styles.routineChip} ${styles.routineChipOn}` : styles.routineChip}
              onClick={() => setParams({ routine: r })}
            >
              {routineLabel(r)}
            </button>
          ))}
          <button
            key="cardio"
            type="button"
            className={isCardio ? `${styles.routineChip} ${styles.routineChipOn}` : styles.routineChip}
            onClick={() => setParams({ routine: 'cardio' })}
          >
            Run
          </button>
        </div>
        {/* Autosave is silent when it works; the one thing worth showing is
            whether what's on screen has reached the server. */}
        {!isCardio && saveState !== 'clean' && (
          <span
            className={
              saveState === 'error'
                ? `${styles.saveState} ${styles.saveStateError}`
                : styles.saveState
            }
            role="status"
            aria-live="polite"
          >
            {saveLabel[saveState]}
          </span>
        )}
      </div>

      {error && <div className={pageStyles.error}>{error}</div>}

      {!isCardio && (
        <>
          {(loading || allExercises.loading) && <div className={pageStyles.loading}>Loading…</div>}

          {!loading && !allExercises.loading && (
            <>
              <div className={styles.exerciseList}>
                {editor.map((ex, i) => (
                  <ExerciseCard
                    // Name, not index: a swap reorders the list, and a card
                    // remounting there would drop what you were typing.
                    key={ex.exerciseId ?? ex.exerciseName}
                    exercise={ex}
                    routine={routine}
                    date={date}
                    pr={prByKey.get(perfKey(ex.exerciseName, ex.variant)) ?? null}
                    orderMoved={moved[i]}
                    expanded={openIndex === i}
                    canMoveUp={i > 0}
                    canMoveDown={i < editor.length - 1}
                    // Only exercises not yet logged: taking over from this one
                    // is what a swap means, and an exercise already done that
                    // day isn't a replacement for anything.
                    swapTargets={editor
                      .filter((other, j) => j !== i && loggedSets(other).length === 0)
                      .map((other) => other.exerciseName)}
                    onToggle={() => toggleExercise(i)}
                    onChange={(next) => updateExercise(i, next)}
                    onVariantChange={(variant) => setVariant(i, variant)}
                    onMove={(dir) => moveExercise(i, dir)}
                    onSwapTo={(name) => swapTo(i, name)}
                  />
                ))}
              </div>

              {existing?.id && (
                <button type="button" className="btn btn--danger" onClick={() => void deleteWorkout()}>
                  Delete this session
                </button>
              )}

              <button
                type="button"
                className={styles.manageToggle}
                onClick={() => setManageOpen((o) => !o)}
              >
                {manageOpen ? 'Hide exercise manager' : 'Manage exercises'}
              </button>
              {manageOpen && (
                <ExerciseManager
                  routine={routine}
                  exercises={(allExercises.data ?? []).filter((e) => e.routine === routine)}
                  onChanged={allExercises.reload}
                />
              )}
            </>
          )}
        </>
      )}

      {isCardio && (
        <section className={`card ${styles.cardioCard}`}>
          <h2>Run</h2>
          <label className={styles.cardioField}>
            <span>Type</span>
            <input
              type="text"
              value={cardioType}
              placeholder="treadmill, outdoor run, bike…"
              onChange={(e) => setCardioType(e.target.value)}
            />
          </label>
          <div className={styles.cardioRow}>
            <div className={styles.cardioField}>
              <span>Time</span>
              <div className={styles.cardioTime}>
                <NumericInput
                  decimal={false}
                  value={cardioMin}
                  placeholder="min"
                  ariaLabel="Minutes"
                  onChange={setCardioMin}
                />
                <span aria-hidden="true">:</span>
                <NumericInput
                  decimal={false}
                  value={cardioSec}
                  placeholder="sec"
                  ariaLabel="Seconds"
                  onChange={setCardioSec}
                />
              </div>
            </div>
            <label className={styles.cardioField}>
              <span>Distance (km)</span>
              <NumericInput
                value={cardioDistance}
                placeholder="5.0"
                ariaLabel="Distance in kilometres"
                onChange={setCardioDistance}
              />
            </label>
          </div>
          {livePace != null && duration != null && (
            <p className={styles.cardioPace} aria-live="polite">
              Pace <strong>{fmtDuration(livePace)}/km</strong> ·{' '}
              {((distance as number) / (duration / 60)).toFixed(1)} km/h
            </p>
          )}
          <label className={styles.cardioField}>
            <span>Notes</span>
            <input
              type="text"
              value={cardioNotes}
              placeholder="optional"
              onChange={(e) => setCardioNotes(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--accent"
            disabled={savingCardio}
            onClick={() => void saveCardio()}
          >
            Save run
          </button>

          {cardioForDay.length > 0 && (
            <ul className={styles.cardioList}>
              {cardioForDay.map((w) => (
                <li key={w.id}>
                  {workoutSummary(w)}
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() =>
                      void api.deleteWorkout(w.id).then(() => {
                        show('Run deleted');
                        recent.reload();
                      })
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <h2 className={pageStyles.sectionTitle}>Recent sessions</h2>
      <ul className={styles.recentList}>
        {recentSessions.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              className={`card ${styles.recentRow}`}
              onClick={() =>
                w.type === 'cardio'
                  ? navigate(`/train?date=${w.date}&routine=cardio`)
                  : navigate(`/train?date=${w.date}&routine=${w.routine}`)
              }
            >
              <span className={styles.recentDate}>{formatMedium(w.date)}</span>
              <span className={styles.recentRoutine}>
                {w.type === 'cardio' ? 'Run' : routineLabel(w.routine ?? '')}
                {w.dateInferred ? ' ≈' : ''}
              </span>
              <span className={styles.recentSummary}>{workoutSummary(w)}</span>
            </button>
          </li>
        ))}
      </ul>

      {toast}
    </div>
  );
}
