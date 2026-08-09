import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExerciseCard } from '../components/train/ExerciseCard';
import { ExerciseManager } from '../components/train/ExerciseManager';
import {
  buildWorkoutExercises,
  editorFromWorkout,
  EditorExercise,
  orderMovedFor,
} from '../components/train/editorTypes';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { Workout } from '../types';
import { addDays, formatMedium, todayStr } from '../utils/dates';
import { ROUTINE_ORDER, routineLabel, workoutSummary } from '../utils/workouts';
import logStyles from './LogPage.module.scss';
import pageStyles from '../styles/page.module.scss';
import styles from '../components/train/train.module.scss';

const LAST_ROUTINE_KEY = 'fitness-tracker-last-routine';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const isCardio = routine === 'cardio';

  useEffect(() => {
    if (isCardio || allExercises.data === null) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.listWorkouts({ from: date, to: date, routine, type: 'strength' }),
      api.getLastWorkout(routine, date),
    ])
      .then(([todays, last]) => {
        if (cancelled) return;
        const workout = todays[0] ?? null;
        const catalog = (allExercises.data ?? [])
          .filter((e) => e.routine === routine && !e.archived)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        setExisting(workout);
        setEditor(editorFromWorkout(workout, catalog, last));
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

  const moveExercise = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= editor.length) return;
    const next = [...editor];
    [next[i], next[j]] = [next[j], next[i]];
    setEditor(next);
  };

  const save = async () => {
    const { exercises, errors } = buildWorkoutExercises(editor);
    if (errors.length > 0) {
      setError(errors.join(' · '));
      return;
    }
    if (exercises.length === 0) {
      setError('Nothing to save yet — log at least one set.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.saveWorkout({
        date,
        type: 'strength',
        routine,
        cardioType: null,
        durationMin: existing?.durationMin ?? null,
        notes: existing?.notes ?? null,
        dateInferred: false,
        exercises,
      });
      show(`${routineLabel(routine)} saved for ${formatMedium(date)} ✓`);
      recent.reload();
      setExisting((prev) => prev ?? ({} as Workout)); // mark as saved
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkout = async () => {
    if (!existing?.id) return;
    if (!window.confirm(`Delete the ${routine} session for ${formatMedium(date)}?`)) return;
    await api.deleteWorkout(existing.id);
    show('Workout deleted');
    setExisting(null);
    recent.reload();
    setParams({});
  };

  // ── Cardio state ─────────────────────────────────────────────────────────
  const [cardioType, setCardioType] = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioNotes, setCardioNotes] = useState('');

  const cardioForDay = (recent.data ?? []).filter(
    (w) => w.type === 'cardio' && w.date === date
  );

  const saveCardio = async () => {
    const duration = Number(cardioDuration);
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Enter the cardio duration in minutes.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.saveWorkout({
        date,
        type: 'cardio',
        routine: null,
        cardioType: cardioType.trim() === '' ? 'cardio' : cardioType.trim(),
        durationMin: Math.round(duration),
        notes: cardioNotes.trim() === '' ? null : cardioNotes.trim(),
        dateInferred: false,
        exercises: [],
      });
      show(`Cardio saved for ${formatMedium(date)} ✓`);
      setCardioType('');
      setCardioDuration('');
      setCardioNotes('');
      recent.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const recentSessions = [...(recent.data ?? [])]
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 8);

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Train</h1>
      </div>

      <div className={`card ${logStyles.dateCard}`}>
        <button
          type="button"
          className={logStyles.dayArrow}
          aria-label="Previous day"
          onClick={() => setParams({ date: addDays(date, -1) })}
        >
          ‹
        </button>
        <div className={logStyles.dateCenter}>
          <input
            type="date"
            value={date}
            max={todayStr()}
            aria-label="Workout date"
            onChange={(e) => e.target.value && setParams({ date: e.target.value })}
            className={logStyles.dateInput}
          />
          <span className={logStyles.dateHuman}>
            {date === todayStr() ? 'Today' : formatMedium(date)}
            {!isCardio && existing && (
              <span className={logStyles.editingBadge}> · editing saved session</span>
            )}
          </span>
        </div>
        <button
          type="button"
          className={logStyles.dayArrow}
          aria-label="Next day"
          disabled={date >= todayStr()}
          onClick={() => setParams({ date: addDays(date, 1) })}
        >
          ›
        </button>
      </div>

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
          Cardio
        </button>
      </div>

      {error && <div className={pageStyles.error}>{error}</div>}

      {!isCardio && (
        <>
          {(loading || allExercises.loading) && <div className={pageStyles.loading}>Loading…</div>}

          {!loading && !allExercises.loading && (
            <>
              {editor.map((ex, i) => (
                <ExerciseCard
                  key={`${ex.exerciseName}-${i}`}
                  exercise={ex}
                  routine={routine}
                  orderMoved={moved[i]}
                  canMoveUp={i > 0}
                  canMoveDown={i < editor.length - 1}
                  onChange={(next) =>
                    setEditor(editor.map((e, j) => (j === i ? next : e)))
                  }
                  onMove={(dir) => moveExercise(i, dir)}
                />
              ))}

              <button
                type="button"
                className="btn btn--accent"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? 'Saving…' : existing ? 'Update session' : 'Save session'}
              </button>
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
          <h2>Cardio session</h2>
          <div className={styles.cardioRow}>
            <label className={styles.cardioField}>
              <span>Type</span>
              <input
                type="text"
                value={cardioType}
                placeholder="treadmill, bike, run…"
                onChange={(e) => setCardioType(e.target.value)}
              />
            </label>
            <label className={styles.cardioField}>
              <span>Duration (min)</span>
              <input
                type="number"
                inputMode="numeric"
                value={cardioDuration}
                placeholder="30"
                onChange={(e) => setCardioDuration(e.target.value)}
              />
            </label>
          </div>
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
            disabled={saving}
            onClick={() => void saveCardio()}
          >
            Save cardio
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
                        show('Cardio deleted');
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
                {w.type === 'cardio' ? 'Cardio' : routineLabel(w.routine ?? '')}
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
