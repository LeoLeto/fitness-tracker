import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  isSetComplete,
  loggedSets,
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
  expanded: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The other exercises of the day — candidates for a mid-session swap. */
  swapTargets: string[];
  onToggle: () => void;
  onChange: (next: EditorExercise) => void;
  onMove: (direction: -1 | 1) => void;
  onSwapTo: (targetName: string) => void;
}

const RIR_OPTIONS = [0, 1, 2, 3, 4];

/**
 * How many rows filling one in opens by itself. Three sets is the plan, so a
 * fourth row appearing after the third was logged is noise, not help — the
 * "+ set" button (and the ghost rows from last session) are there for the
 * sessions that do go further.
 */
const AUTO_OPENED_SETS = 3;

export function ExerciseCard({
  exercise,
  routine,
  date,
  pr,
  orderMoved,
  expanded,
  canMoveUp,
  canMoveDown,
  swapTargets,
  onToggle,
  onChange,
  onMove,
  onSwapTo,
}: ExerciseCardProps) {
  // Both start closed: the variation is a rare footnote, and a swap is rarer
  // still. Neither earns permanent space in a row you fill in mid-set.
  const [commentOpen, setCommentOpen] = useState(exercise.variation !== '');
  const [swapOpen, setSwapOpen] = useState(false);

  /**
   * Applies a change to one set and, while still short of the usual three,
   * opens the next row — logging a set and reaching for the next are the same
   * action, so "+ set" was a tap between every set of every exercise. Past
   * three it stops: a fourth set is deliberate, so it takes a deliberate tap.
   */
  const updateSet = (i: number, patch: Partial<EditorSet>) => {
    const sets = exercise.sets.map((s, j) => (j === i ? { ...s, ...patch } : s));
    const edited = sets[i];
    const isLast = i === sets.length - 1;
    const ready = isSetComplete(edited, exercise.isBodyweight) && edited.rir !== null;
    if (isLast && ready && sets.length < AUTO_OPENED_SETS) {
      sets.push(emptyEditorSet(edited.weight));
    }
    onChange({ ...exercise, sets });
  };

  /**
   * Opens `count` more rows, each carrying the weight of the one before it —
   * the usual case is the same load again, and a ghost placeholder still shows
   * last session's number in the reps field.
   */
  const addSets = (count = 1) => {
    const sets = [...exercise.sets];
    for (let n = 0; n < count; n++) {
      sets.push(emptyEditorSet(sets[sets.length - 1]?.weight ?? ''));
    }
    onChange({ ...exercise, sets });
  };

  const removeSet = (i: number) => {
    onChange({ ...exercise, sets: exercise.sets.filter((_, j) => j !== i) });
  };

  const done = loggedSets(exercise);

  /**
   * Where this session stands right now — recomputed as you type, so beating a
   * record is visible while there's still time to add another set.
   */
  const beat = useMemo(() => {
    if (pr === null) return null;
    const live = bestPerformance(done);
    if (live === null || !beatsPerformance(live, pr)) return null;
    return {
      metric: formatPerformance(live),
      gain:
        live.e1rm != null && pr.e1rm != null
          ? `+${(live.e1rm - pr.e1rm).toFixed(1)} kg`
          : `+${live.effectiveReps - pr.effectiveReps} reps`,
    };
  }, [done, pr]);

  // Whatever is left of last session below the rows already on screen, so the
  // whole of last time is visible without remembering how it ended.
  const remainingGhosts: WorkoutSet[] = (exercise.last?.sets ?? []).slice(exercise.sets.length);

  return (
    <section className={`${styles.exercise} ${expanded ? styles.exerciseOpen : ''}`}>
      <header className={styles.exerciseHeader}>
        <button
          type="button"
          className={styles.exerciseTitle}
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className={styles.exerciseName}>
            {exercise.exerciseName}
            {orderMoved === 'up' && <span className={styles.orderBadge}> ⬆️</span>}
            {orderMoved === 'down' && <span className={styles.orderBadge}> ⬇️</span>}
            {done.length > 0 && <span className={styles.setCount}>{done.length}</span>}
          </span>
          {exercise.swappedFrom && (
            <span className={styles.swapBadge}>⇄ after {exercise.swappedFrom}</span>
          )}
          {expanded && exercise.setupNotes && (
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

      {/* Collapsed, an exercise is just its numbers — the same notation the
          rest of the app and the exports use. */}
      {!expanded && done.length > 0 && (
        <p className={styles.collapsedSummary}>
          {formatSets(done)}
          {exercise.variation !== '' && <span className={styles.collapsedVariation}> ({exercise.variation})</span>}
        </p>
      )}

      {expanded && (
        <>
          {exercise.last && (
            <p className={styles.lastLine}>
              <span className={styles.lastLabel}>last ({formatShort(exercise.last.date)}):</span>{' '}
              {formatSets(exercise.last.sets)}
              {exercise.last.variation ? ` (${exercise.last.variation})` : ''}
            </p>
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

          {exercise.sets.length > 0 && (
            <div className={styles.setsHeader}>
              <span>{exercise.isBodyweight ? 'kg*' : 'kg'}</span>
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

          {/* The rest of last session, in line with the rows above it: tapping
              one opens a real row already carrying that weight. */}
          {remainingGhosts.map((s, i) => (
            <button
              key={`ghost-${i}`}
              type="button"
              className={styles.ghostRow}
              // Tapping the third ghost opens rows up to the third, not one —
              // the tap says "I'm on that set", not "give me one more".
              onClick={() => addSets(i + 1)}
            >
              <span className={styles.ghostIndex}>{exercise.sets.length + i + 1}</span>
              <span className={styles.ghostSet}>{formatSets([s])}</span>
              <span className={styles.ghostHint}>last time</span>
            </button>
          ))}

          <div className={styles.exerciseActions}>
            <button type="button" className={styles.smallBtn} onClick={() => addSets()}>
              + set
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              aria-expanded={commentOpen}
              onClick={() => setCommentOpen((o) => !o)}
            >
              {exercise.variation !== '' ? '✎ comment' : '+ comment'}
            </button>
            {swapTargets.length > 0 && (
              <button
                type="button"
                className={styles.smallBtn}
                aria-expanded={swapOpen}
                onClick={() => setSwapOpen((o) => !o)}
              >
                ⇄ swap
              </button>
            )}
          </div>

          {commentOpen && (
            <input
              type="text"
              className={styles.variation}
              value={exercise.variation}
              placeholder="variation or note (e.g. w/step, barbell)"
              aria-label="Variation"
              autoFocus={exercise.variation === ''}
              onChange={(e) => onChange({ ...exercise, variation: e.target.value })}
            />
          )}

          {/* Abandoning a movement mid-exercise and finishing it on another one
              is a real thing that happens; recording it keeps both partial
              exercises honest instead of looking like two bad sessions. */}
          {swapOpen && (
            <div className={styles.swapPanel}>
              <p className={styles.swapHint}>
                Stopped this exercise and carried on with another one? Pick it — the sets
                already logged here stay put.
              </p>
              <div className={styles.swapOptions}>
                {swapTargets.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={styles.swapOption}
                    onClick={() => {
                      setSwapOpen(false);
                      onSwapTo(name);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
