import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DayNav } from '../components/DayNav';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { DailyEntry, Meal } from '../types';
import { formatMedium, todayStr } from '../utils/dates';
import { fmtGrams, fmtKcal } from '../utils/format';
import pageStyles from '../styles/page.module.scss';
import styles from './FoodPage.module.scss';

/** Editor row for one meal. Numbers stay strings while typing. */
interface EditorMeal {
  key: number;
  label: string;
  time: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string | null;
}

let keyCounter = 0;
const nextKey = () => ++keyCounter;

function editorFromMeal(meal: Meal): EditorMeal {
  return {
    key: nextKey(),
    label: meal.label,
    time: meal.time ?? '',
    calories: String(meal.calories),
    protein: meal.proteinG != null ? String(meal.proteinG) : '',
    carbs: meal.carbsG != null ? String(meal.carbsG) : '',
    fat: meal.fatG != null ? String(meal.fatG) : '',
    notes: meal.notes,
  };
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** '' → null, otherwise a finite number or undefined when unparseable. */
function parseNum(s: string): number | null | undefined {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Live totals from the editor rows, so the day accumulates as you type. */
function editorTotals(rows: EditorMeal[]) {
  const sum = (key: 'protein' | 'carbs' | 'fat') => {
    const values = rows
      .map((r) => parseNum(r[key]))
      .filter((v): v is number => typeof v === 'number');
    return { total: values.length > 0 ? values.reduce((a, b) => a + b, 0) : null, count: values.length };
  };
  const calorieValues = rows
    .map((r) => parseNum(r.calories))
    .filter((v): v is number => typeof v === 'number');
  return {
    calories: calorieValues.reduce((a, b) => a + b, 0),
    calorieRows: calorieValues.length,
    protein: sum('protein'),
    carbs: sum('carbs'),
    fat: sum('fat'),
    mealCount: rows.length,
  };
}

export function FoodPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramDate = searchParams.get('date');
  const date = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : todayStr();

  const [rows, setRows] = useState<EditorMeal[]>([]);
  const [mode, setMode] = useState<'meals' | 'total'>('meals');
  const [dayTotal, setDayTotal] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show } = useToast();

  const allEntries = useApi(() => api.listEntries(), []);
  const profile = useApi(() => api.getProfile(), []);

  // Labels already used, newest first — powers the quick-pick datalist.
  const knownLabels = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of [...(allEntries.data ?? [])].reverse()) {
      for (const meal of entry.meals) {
        const key = meal.label.trim().toLowerCase();
        if (key !== '' && !seen.has(key)) seen.set(key, meal.label.trim());
      }
    }
    return [...seen.values()].slice(0, 40);
  }, [allEntries.data]);

  const loadEntry = (entry: DailyEntry | null) => {
    if (entry && entry.meals.length > 0) {
      setRows(entry.meals.map(editorFromMeal));
      setMode('meals');
    } else if (entry && entry.calories != null) {
      // Legacy / quick-total day: keep showing it as a single total.
      setRows([]);
      setMode('total');
      setDayTotal({
        calories: String(entry.calories),
        protein: entry.proteinG != null ? String(entry.proteinG) : '',
        carbs: entry.carbsG != null ? String(entry.carbsG) : '',
        fat: entry.fatG != null ? String(entry.fatG) : '',
      });
    } else {
      setRows([]);
      setMode('meals');
      setDayTotal({ calories: '', protein: '', carbs: '', fat: '' });
    }
    setDirty(false);
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .getEntry(date)
      .then((entry) => {
        if (!cancelled) loadEntry(entry);
      })
      .catch(() => {
        if (!cancelled) loadEntry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const totals = editorTotals(rows);
  const target = profile.data?.calorieTarget ?? null;
  const shownCalories = mode === 'meals' ? totals.calories : parseNum(dayTotal.calories) ?? 0;
  const remaining = target != null ? target - shownCalories : null;

  const updateRow = (key: number, patch: Partial<EditorMeal>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addMeal = () => {
    setRows((rs) => [
      ...rs,
      {
        key: nextKey(),
        label: '',
        // Stamp the time only for today — back-filling a past day shouldn't
        // claim a meal happened at the moment you typed it in.
        time: date === todayStr() ? currentTime() : '',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        notes: null,
      },
    ]);
    setDirty(true);
  };

  const removeMeal = (key: number) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    setDirty(true);
  };

  const saveMeals = async () => {
    const meals: Meal[] = [];
    for (const [i, row] of rows.entries()) {
      const calories = parseNum(row.calories);
      if (calories === null) {
        setError(`Meal ${i + 1} needs a calorie value (or remove the row).`);
        return;
      }
      const macros = {
        proteinG: parseNum(row.protein),
        carbsG: parseNum(row.carbs),
        fatG: parseNum(row.fat),
      };
      if (calories === undefined || Object.values(macros).includes(undefined)) {
        setError(`Meal ${i + 1} has a value that isn't a number.`);
        return;
      }
      meals.push({
        label: row.label.trim(),
        time: row.time.trim() === '' ? null : row.time,
        calories: Math.round(calories),
        proteinG: macros.proteinG as number | null,
        carbsG: macros.carbsG as number | null,
        fatG: macros.fatG as number | null,
        notes: row.notes,
      });
    }

    setError(null);
    setSaving(true);
    try {
      // PATCH only the food slice; the server re-derives the day's totals.
      const saved = await api.patchEntry(date, { meals });
      loadEntry(saved);
      allEntries.reload();
      show(
        meals.length === 0
          ? 'Meals cleared'
          : `${meals.length} meal${meals.length === 1 ? '' : 's'} saved · ${fmtKcal(totals.calories)} ✓`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveDayTotal = async () => {
    const values = {
      calories: parseNum(dayTotal.calories),
      proteinG: parseNum(dayTotal.protein),
      carbsG: parseNum(dayTotal.carbs),
      fatG: parseNum(dayTotal.fat),
    };
    if (Object.values(values).includes(undefined)) {
      setError("One of those values isn't a number.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await api.patchEntry(date, {
        calories: values.calories != null ? Math.round(values.calories) : null,
        proteinG: values.proteinG as number | null,
        carbsG: values.carbsG as number | null,
        fatG: values.fatG as number | null,
        meals: [],
      });
      loadEntry(saved);
      allEntries.reload();
      show(`Day total saved for ${formatMedium(date)} ✓`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /** Turns an existing day total into a first meal, without losing the number. */
  const splitTotalIntoMeals = () => {
    const calories = parseNum(dayTotal.calories);
    setRows(
      calories != null && calories !== undefined
        ? [
            {
              key: nextKey(),
              label: 'Day total',
              time: '',
              calories: String(Math.round(calories)),
              protein: dayTotal.protein,
              carbs: dayTotal.carbs,
              fat: dayTotal.fat,
              notes: null,
            },
          ]
        : []
    );
    setMode('meals');
    setDirty(true);
  };

  const switchToDayTotal = () => {
    if (rows.length > 0) {
      const ok = window.confirm(
        `Replace the ${rows.length} logged meal${rows.length === 1 ? '' : 's'} with a single day total?`
      );
      if (!ok) return;
      setDayTotal({
        calories: String(totals.calories),
        protein: totals.protein.total != null ? String(totals.protein.total) : '',
        carbs: totals.carbs.total != null ? String(totals.carbs.total) : '',
        fat: totals.fat.total != null ? String(totals.fat.total) : '',
      });
      setRows([]);
    }
    setMode('total');
    setDirty(true);
  };

  const macroNote = (stat: { total: number | null; count: number }) =>
    stat.total != null && stat.count < totals.mealCount
      ? ` · ${stat.count}/${totals.mealCount} meals`
      : '';

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Food</h1>
      </div>

      <DayNav
        date={date}
        onChange={(next) => setSearchParams({ date: next })}
        sibling={<Link to={`/weigh?date=${date}`}>Weigh-in for this day →</Link>}
      />

      {/* Running total for the day — the number that accumulates as meals are added. */}
      <section className={`card ${styles.totalCard}`}>
        <div className={styles.totalMain}>
          <div>
            <div className={styles.totalLabel}>Total today</div>
            <div className={styles.totalValue}>
              {Math.round(shownCalories).toLocaleString('en-US')}
              <span className={styles.totalUnit}> kcal</span>
            </div>
          </div>
          {target != null && (
            <div className={styles.targetSide}>
              <div className={styles.totalLabel}>Target {fmtKcal(target)}</div>
              <div
                className={
                  remaining != null && remaining < 0 ? styles.remainingOver : styles.remaining
                }
              >
                {remaining != null && remaining >= 0
                  ? `${Math.round(remaining).toLocaleString('en-US')} left`
                  : `${Math.abs(Math.round(remaining ?? 0)).toLocaleString('en-US')} over`}
              </div>
            </div>
          )}
        </div>

        {target != null && target > 0 && (
          <div
            className={styles.meter}
            role="img"
            aria-label={`${Math.round(shownCalories)} of ${target} kcal`}
          >
            <div
              className={shownCalories > target ? styles.meterFillOver : styles.meterFill}
              style={{ width: `${Math.min(100, (shownCalories / target) * 100)}%` }}
            />
          </div>
        )}

        {mode === 'meals' && totals.mealCount > 0 && (
          <div className={styles.macroRow}>
            <span>
              P {fmtGrams(totals.protein.total)}
              <span className={styles.macroNote}>{macroNote(totals.protein)}</span>
            </span>
            <span>
              C {fmtGrams(totals.carbs.total)}
              <span className={styles.macroNote}>{macroNote(totals.carbs)}</span>
            </span>
            <span>
              F {fmtGrams(totals.fat.total)}
              <span className={styles.macroNote}>{macroNote(totals.fat)}</span>
            </span>
          </div>
        )}
      </section>

      {error && <div className={pageStyles.error}>{error}</div>}

      {mode === 'meals' ? (
        <>
          {rows.length === 0 && (
            <div className={`card ${styles.empty}`}>
              No food logged for this day yet.
            </div>
          )}

          {rows.map((row, i) => (
            <section key={row.key} className={`card ${styles.meal}`}>
              <div className={styles.mealHeader}>
                <span className={styles.mealIndex}>{i + 1}</span>
                <input
                  type="text"
                  className={styles.mealLabel}
                  list="known-meal-labels"
                  value={row.label}
                  placeholder="e.g. Breakfast, chicken & rice"
                  aria-label={`Meal ${i + 1} label`}
                  onChange={(e) => updateRow(row.key, { label: e.target.value })}
                />
                <input
                  type="time"
                  className={styles.mealTime}
                  value={row.time}
                  aria-label={`Meal ${i + 1} time`}
                  onChange={(e) => updateRow(row.key, { time: e.target.value })}
                />
                <button
                  type="button"
                  className={styles.removeMeal}
                  aria-label={`Remove meal ${i + 1}`}
                  onClick={() => removeMeal(row.key)}
                >
                  ✕
                </button>
              </div>

              <div className={styles.mealFields}>
                <label className={styles.mealField}>
                  <span>kcal</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    className={styles.kcalInput}
                    value={row.calories}
                    aria-label={`Meal ${i + 1} calories`}
                    onChange={(e) => updateRow(row.key, { calories: e.target.value })}
                  />
                </label>
                <label className={styles.mealField}>
                  <span>protein</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.protein}
                    aria-label={`Meal ${i + 1} protein`}
                    onChange={(e) => updateRow(row.key, { protein: e.target.value })}
                  />
                </label>
                <label className={styles.mealField}>
                  <span>carbs</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.carbs}
                    aria-label={`Meal ${i + 1} carbs`}
                    onChange={(e) => updateRow(row.key, { carbs: e.target.value })}
                  />
                </label>
                <label className={styles.mealField}>
                  <span>fat</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.fat}
                    aria-label={`Meal ${i + 1} fat`}
                    onChange={(e) => updateRow(row.key, { fat: e.target.value })}
                  />
                </label>
              </div>
            </section>
          ))}

          <datalist id="known-meal-labels">
            {knownLabels.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>

          <button type="button" className="btn" onClick={addMeal}>
            + Add meal
          </button>

          <button
            type="button"
            className={dirty ? 'btn btn--accent' : 'btn'}
            disabled={saving || !dirty}
            onClick={() => void saveMeals()}
          >
            {saving ? 'Saving…' : dirty ? 'Save meals' : 'Saved'}
          </button>

          {dirty && <p className={styles.dirtyNote}>You have unsaved changes.</p>}

          <button type="button" className={styles.modeSwitch} onClick={switchToDayTotal}>
            Log a single day total instead
          </button>
        </>
      ) : (
        <>
          <section className={`card ${styles.section}`}>
            <h2 className={styles.sectionHeading}>Day total</h2>
            <div className={styles.mealFields}>
              <label className={styles.mealField}>
                <span>kcal</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className={styles.kcalInput}
                  value={dayTotal.calories}
                  aria-label="Day calories"
                  onChange={(e) => {
                    setDayTotal((d) => ({ ...d, calories: e.target.value }));
                    setDirty(true);
                  }}
                />
              </label>
              <label className={styles.mealField}>
                <span>protein</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={dayTotal.protein}
                  aria-label="Day protein"
                  onChange={(e) => {
                    setDayTotal((d) => ({ ...d, protein: e.target.value }));
                    setDirty(true);
                  }}
                />
              </label>
              <label className={styles.mealField}>
                <span>carbs</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={dayTotal.carbs}
                  aria-label="Day carbs"
                  onChange={(e) => {
                    setDayTotal((d) => ({ ...d, carbs: e.target.value }));
                    setDirty(true);
                  }}
                />
              </label>
              <label className={styles.mealField}>
                <span>fat</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={dayTotal.fat}
                  aria-label="Day fat"
                  onChange={(e) => {
                    setDayTotal((d) => ({ ...d, fat: e.target.value }));
                    setDirty(true);
                  }}
                />
              </label>
            </div>
          </section>

          <button
            type="button"
            className={dirty ? 'btn btn--accent' : 'btn'}
            disabled={saving || !dirty}
            onClick={() => void saveDayTotal()}
          >
            {saving ? 'Saving…' : dirty ? 'Save day total' : 'Saved'}
          </button>

          <button type="button" className={styles.modeSwitch} onClick={splitTotalIntoMeals}>
            Switch to meal-by-meal logging
          </button>
        </>
      )}

      {toast}
    </div>
  );
}
