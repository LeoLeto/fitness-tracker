import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { PersonalBest, WorkoutSet } from '../../types';
import { NumericInput } from '../fields';
import { formatShort } from '../../utils/dates';
import {
  beatsPerformance,
  bestPerformance,
  formatPerformance,
  formatSet,
  formatSets,
} from '../../utils/workouts';
import {
  EditorExercise,
  EditorSet,
  emptyEditorSet,
  setFromWorkout,
  setToWorkout,
} from './editorTypes';
import styles from './train.module.scss';

interface ExerciseCardProps {
  exercise: EditorExercise;
  routine: string;
  /** The day being edited — tells a record set in this session from an older one. */
  date: string;
  /** All-time best set of this exercise, or null if it has never been logged. */
  pr: PersonalBest | null;
  orderMoved: 'up' | 'down' | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: EditorExercise) => void;
  onMove: (direction: -1 | 1) => void;
}

const RIR_OPTIONS = [0, 1, 2, 3, 4];

export function ExerciseCard({
  exercise,
  routine,
  date,
  pr,
  orderMoved,
  canMoveUp,
  canMoveDown,
  onChange,
  onMove,
}: ExerciseCardProps) {
  const [quickText, setQuickText] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickWarnings, setQuickWarnings] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(exercise.sets.length > 0);

  const updateSet = (i: number, patch: Partial<EditorSet>) => {
    const sets = exercise.sets.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onChange({ ...exercise, sets });
  };

  const addSet = () => {
    const prev = exercise.sets[exercise.sets.length - 1];
    onChange({ ...exercise, sets: [...exercise.sets, emptyEditorSet(prev?.weight ?? '')] });
    setExpanded(true);
  };

  const removeSet = (i: number) => {
    onChange({ ...exercise, sets: exercise.sets.filter((_, j) => j !== i) });
  };

  const copyLast = () => {
    if (!exercise.last) return;
    onChange({
      ...exercise,
      sets: exercise.last.sets.map(setFromWorkout),
      variation: exercise.last.variation ?? exercise.variation,
    });
    setExpanded(true);
  };

  const parseQuick = async () => {
    if (quickText.trim() === '') return;
    try {
      const parsed = await api.parseSetText(quickText, exercise.isBodyweight);
      const warnings = [...parsed.warnings];
      if (parsed.orderMoved) {
        warnings.push('Order swap noted — use the ↑↓ arrows to reorder the exercise.');
      }
      onChange({
        ...exercise,
        sets: parsed.sets.map(setFromWorkout),
        variation: parsed.variation ?? exercise.variation,
      });
      setQuickWarnings(warnings);
      setExpanded(true);
      if (parsed.sets.length > 0) setQuickText('');
    } catch {
      setQuickWarnings(['Could not parse that line.']);
    }
  };

  const loggedSets = exercise.sets.length;

  /**
   * Where this session stands right now — recomputed as you type, so beating a
   * record is visible while there's still time to add another set.
   */
  const beat = useMemo(() => {
    if (pr === null) return null;
    const sets = exercise.sets
      .map(setToWorkout)
      .filter((s): s is WorkoutSet => s !== 'invalid' && s !== 'empty');
    const live = bestPerformance(sets);
    if (live === null || !beatsPerformance(live, pr)) return null;
    return {
      metric: formatPerformance(live),
      gain:
        live.e1rm != null && pr.e1rm != null
          ? `+${(live.e1rm - pr.e1rm).toFixed(1)} kg`
          : `+${live.effectiveReps - pr.effectiveReps} reps`,
    };
  }, [exercise.sets, pr]);

  return (
    <section className={`card ${styles.exercise}`}>
      <header className={styles.exerciseHeader}>
        <button
          type="button"
          className={styles.exerciseTitle}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <span className={styles.exerciseName}>
            {exercise.exerciseName}
            {orderMoved === 'up' && <span className={styles.orderBadge}> ⬆️</span>}
            {orderMoved === 'down' && <span className={styles.orderBadge}> ⬇️</span>}
          </span>
          {exercise.setupNotes && (
            <span className={styles.setupNotes}>{exercise.setupNotes}</span>
          )}
        </button>
        <div className={styles.headerActions}>
          <Link
            className={styles.progressLink}
            to={`/train/exercise?name=${encodeURIComponent(exercise.exerciseName)}&routine=${encodeURIComponent(routine)}`}
            aria-label={`${exercise.exerciseName} progress chart`}
          >
            ∿
          </Link>
          <button
            type="button"
            className={styles.moveBtn}
            disabled={!canMoveUp}
            aria-label="Move exercise earlier"
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.moveBtn}
            disabled={!canMoveDown}
            aria-label="Move exercise later"
            onClick={() => onMove(1)}
          >
            ↓
          </button>
        </div>
      </header>

      {exercise.last && (
        <button type="button" className={styles.lastLine} onClick={copyLast}>
          <span className={styles.lastLabel}>last ({formatShort(exercise.last.date)}):</span>{' '}
          {formatSets(exercise.last.sets)}
          {exercise.last.variation ? ` (${exercise.last.variation})` : ''}
          <span className={styles.copyHint}>⟳ tap to copy</span>
        </button>
      )}

      {pr && (
        <p className={beat ? `${styles.prLine} ${styles.prLineBeat}` : styles.prLine}>
          <span className={styles.prLabel}>
            🏆 {pr.date === date ? 'PR this session' : 'PR'}
          </span>{' '}
          {formatPerformance(pr)}
          <span className={styles.prSet}>
            {' · '}
            {formatSet(pr)}
            {pr.badForm && ' ✱'}
            {pr.pain && ' 🚨'}
            {pr.date !== date && ` · ${formatShort(pr.date)}`}
          </span>
          {beat && (
            <span className={styles.prBeat}>
              new PR {beat.metric} ({beat.gain})
            </span>
          )}
        </p>
      )}

      {expanded && (
        <>
          {exercise.sets.length > 0 && (
            <div className={styles.setsHeader}>
              <span>{exercise.isBodyweight ? 'kg (opt.)' : 'kg'}</span>
              <span>reps</span>
              <span>RIR</span>
              <span>flags</span>
              <span />
            </div>
          )}
          {exercise.sets.map((s, i) => {
            // Ghost of the same set number last time round: an empty field shows
            // what you did then, so matching or beating it needs no scrolling.
            const ghost = exercise.last?.sets[i] ?? null;
            return (
              <div key={i} className={styles.setRow}>
                <NumericInput
                  value={s.weight}
                  placeholder={
                    ghost?.weightKg != null
                      ? String(ghost.weightKg)
                      : exercise.isBodyweight
                        ? 'BW'
                        : 'kg'
                  }
                  className={ghost?.weightKg != null ? styles.ghost : undefined}
                  ariaLabel={`Set ${i + 1} weight`}
                  onChange={(v) => updateSet(i, { weight: v })}
                />
                <NumericInput
                  decimal={false}
                  value={s.reps}
                  placeholder={ghost ? String(ghost.reps) : 'reps'}
                  className={ghost ? styles.ghost : undefined}
                  ariaLabel={`Set ${i + 1} reps`}
                  onChange={(v) => updateSet(i, { reps: v })}
                />
                <div className={styles.rirChips} role="group" aria-label={`Set ${i + 1} RIR`}>
                  {RIR_OPTIONS.map((r) => {
                    // Last time's RIR is outlined until this set records its own.
                    const ghosted = s.rir === null && ghost?.rir === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        className={
                          s.rir === r
                            ? `${styles.chip} ${styles.chipOn}`
                            : ghosted
                              ? `${styles.chip} ${styles.chipGhost}`
                              : styles.chip
                        }
                        aria-pressed={s.rir === r}
                        onClick={() => updateSet(i, { rir: s.rir === r ? null : r })}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.flagChips} role="group" aria-label={`Set ${i + 1} flags`}>
                  <button
                    type="button"
                    title="Rep count uncertain (?)"
                    className={s.repsUncertain ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                    aria-pressed={s.repsUncertain}
                    onClick={() => updateSet(i, { repsUncertain: !s.repsUncertain })}
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    title="Last rep with bad form (*)"
                    className={s.badForm ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                    aria-pressed={s.badForm}
                    onClick={() => updateSet(i, { badForm: !s.badForm })}
                  >
                    ✱
                  </button>
                  <button
                    type="button"
                    title="Cut short because of pain (🚨)"
                    className={s.pain ? `${styles.chip} ${styles.chipPain}` : styles.chip}
                    aria-pressed={s.pain}
                    onClick={() => updateSet(i, { pain: !s.pain })}
                  >
                    🚨
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.removeSet}
                  aria-label={`Remove set ${i + 1}`}
                  onClick={() => removeSet(i)}
                >
                  ✕
                </button>
              </div>
            );
          })}

          <div className={styles.exerciseActions}>
            <button type="button" className={styles.smallBtn} onClick={addSet}>
              + set
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => setQuickOpen((o) => !o)}
            >
              quick text
            </button>
            <input
              type="text"
              className={styles.variation}
              value={exercise.variation}
              placeholder="variation (e.g. w/step, barbell)"
              aria-label="Variation"
              onChange={(e) => onChange({ ...exercise, variation: e.target.value })}
            />
          </div>

          {quickOpen && (
            <div className={styles.quickRow}>
              <input
                type="text"
                value={quickText}
                placeholder='e.g. 90 x7 (2 RIR) x7 (1 RIR) x8* (0 RIR)'
                aria-label="Quick text entry"
                onChange={(e) => setQuickText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void parseQuick();
                  }
                }}
              />
              <button type="button" className={styles.smallBtn} onClick={() => void parseQuick()}>
                Parse
              </button>
            </div>
          )}
          {quickWarnings.length > 0 && (
            <p className={styles.quickWarnings}>{quickWarnings.join(' · ')}</p>
          )}
        </>
      )}

      {!expanded && loggedSets > 0 && (
        <p className={styles.collapsedSummary}>{loggedSets} sets logged</p>
      )}
    </section>
  );
}
