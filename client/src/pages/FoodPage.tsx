import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DayNav } from '../components/DayNav';
import { NumericInput } from '../components/fields';
import { QuickAdd } from '../components/food/QuickAdd';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { DailyEntry, Meal } from '../types';
import { formatMedium, todayStr } from '../utils/dates';
import { fmtGrams, fmtKcal } from '../utils/format';
import { parseDecimal } from '../utils/numeric';
import { scrollToTop } from '../utils/scroll';
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
  fiber: string;
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
    fiber: meal.fiberG != null ? String(meal.fiberG) : '',
    notes: meal.notes,
  };
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const parseNum = parseDecimal;

/**
 * Serialises editor rows into meals, or explains why they can't be saved yet.
 * Shared by the manual save and the auto-save behind a one-tap quick add.
 */
function mealsFromRows(rows: EditorMeal[]): { meals: Meal[] } | { error: string } {
  const meals: Meal[] = [];
  for (const [i, row] of rows.entries()) {
    const calories = parseNum(row.calories);
    if (calories === null) {
      return { error: `Meal ${i + 1} needs a calorie value (or remove the row).` };
    }
    const macros = {
      proteinG: parseNum(row.protein),
      carbsG: parseNum(row.carbs),
      fatG: parseNum(row.fat),
      fiberG: parseNum(row.fiber),
    };
    if (calories === undefined || Object.values(macros).includes(undefined)) {
      return { error: `Meal ${i + 1} has a value that isn't a number.` };
    }
    meals.push({
      label: row.label.trim(),
      time: row.time.trim() === '' ? null : row.time,
      calories: Math.round(calories),
      proteinG: macros.proteinG as number | null,
      carbsG: macros.carbsG as number | null,
      fatG: macros.fatG as number | null,
      fiberG: macros.fiberG as number | null,
      notes: row.notes,
    });
  }
  return { meals };
}

/** Live totals from the editor rows, so the day accumulates as you type. */
function editorTotals(rows: EditorMeal[]) {
  const sum = (key: 'protein' | 'carbs' | 'fat' | 'fiber') => {
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
    fiber: sum('fiber'),
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
  const [quickOpen, setQuickOpen] = useState(true);
  // Meals already eaten are history, not the thing you came to do — the list
  // stays folded away behind its count until you actually need to edit a row.
  const [mealsOpen, setMealsOpen] = useState(false);
  const { toast, show } = useToast();

  const allEntries = useApi(() => api.listEntries(), []);
  const profile = useApi(() => api.getProfile(), []);
  const foods = useApi(() => api.listFoods(), []);
  const templates = useApi(() => api.listMealTemplates(), []);

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
    // Reached on every load and after every save: a freshly persisted day is
    // exactly the case where the meal list has nothing left to say.
    setMealsOpen(false);
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
        fiber: '',
        notes: null,
      },
    ]);
    setDirty(true);
    setMealsOpen(true); // the new row is only useful if you can see it
  };

  const removeMeal = (key: number) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    setDirty(true);
  };

  /** Restores the day to a saved meal list — the "Undo" behind a quick add. */
  const revertTo = async (meals: Meal[]) => {
    setSaving(true);
    try {
      // An empty list must clear the derived totals explicitly: with no meals
      // the server leaves day totals alone, so they'd survive as stale numbers.
      const saved = await api.patchEntry(
        date,
        meals.length > 0
          ? { meals }
          : { meals: [], calories: null, proteinG: null, carbsG: null, fatG: null, fiberG: null }
      );
      loadEntry(saved);
      allEntries.reload();
      show('Undone');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Appends meals chosen from the library and saves them straight away — the
   * point of one-tap logging is not having to scroll down and confirm. The
   * pre-add meal list rides along with the toast, so a mistap is one tap from
   * being reverted for the next 5 seconds.
   */
  const addFromLibrary = async (chosen: Meal[]) => {
    // Logged now, so stamped now. A template carries a planned time (04:15…)
    // which is the plan's, not the day's; on a back-filled day that plan time
    // is still better than nothing, but today's clock beats it.
    const added: Meal[] =
      date === todayStr()
        ? chosen.map((m) => ({ ...m, time: currentTime() }))
        : chosen;
    const label = added.length === 1 ? added[0].label || 'meal' : `${added.length} meals`;
    const addedKcal = added.reduce((acc, m) => acc + m.calories, 0);
    const appendRows = () => setRows((rs) => [...rs, ...added.map(editorFromMeal)]);

    // In day-total mode the day is deliberately "one number"; committing meals
    // would silently discard that total, so keep the explicit save there.
    if (mode === 'total') {
      appendRows();
      setMode('meals');
      setDirty(true);
      setMealsOpen(true);
      show(`Added ${label} — save to replace the day total`);
      return;
    }

    const existing = mealsFromRows(rows);
    if ('error' in existing) {
      // A half-typed row can't be persisted, and guessing a value for it would
      // be inventing data — fall back to the manual save.
      appendRows();
      setDirty(true);
      setMealsOpen(true); // the row that needs fixing has to be reachable
      setError(existing.error);
      show(`Added ${label} — fix that row, then save`);
      return;
    }

    appendRows();
    setError(null);
    setSaving(true);
    try {
      const saved = await api.patchEntry(date, { meals: [...existing.meals, ...added] });
      loadEntry(saved);
      allEntries.reload();
      // The day total is at the top of the page and is the reason for logging at
      // all — after a save that's where you want to be, not deep in the list.
      scrollToTop();
      show(`Added ${label} · ${fmtKcal(addedKcal)}`, {
        action: { label: 'Undo', onAction: () => void revertTo(existing.meals) },
      });
    } catch (err) {
      // The row is in the editor but not in the database — say so, and leave the
      // manual save as the retry.
      setDirty(true);
      setMealsOpen(true);
      const why = err instanceof Error ? err.message : 'Save failed';
      setError(`${why} — ${label} is not saved yet; use “Save meals” to retry.`);
    } finally {
      setSaving(false);
    }
  };

  const saveMeals = async () => {
    const serialized = mealsFromRows(rows);
    if ('error' in serialized) {
      setError(serialized.error);
      setMealsOpen(true);
      return;
    }
    const { meals } = serialized;

    setError(null);
    setSaving(true);
    try {
      // PATCH only the food slice; the server re-derives the day's totals.
      const saved = await api.patchEntry(date, { meals });
      loadEntry(saved);
      allEntries.reload();
      scrollToTop();
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
              fiber: '',
              notes: null,
            },
          ]
        : []
    );
    setMode('meals');
    setDirty(true);
    setMealsOpen(true); // splitting a total is an edit — show what it became
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
      <DayNav date={date} onChange={(next) => setSearchParams({ date: next })} />

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
            <span>
              Fib {fmtGrams(totals.fiber.total)}
              <span className={styles.macroNote}>{macroNote(totals.fiber)}</span>
            </span>
          </div>
        )}
      </section>

      <div className={styles.quickHeader}>
        <button
          type="button"
          className={styles.quickToggle}
          aria-expanded={quickOpen}
          onClick={() => setQuickOpen((o) => !o)}
        >
          {quickOpen ? '▾' : '▸'} Quick add from library
        </button>
        <Link to="/foods" className={styles.libraryLink}>
          Edit library
        </Link>
      </div>
      {quickOpen && (
        <QuickAdd
          foods={foods.data ?? []}
          templates={templates.data ?? []}
          onAdd={(meals) => void addFromLibrary(meals)}
          busy={saving}
        />
      )}

      {error && <div className={pageStyles.error}>{error}</div>}

      {mode === 'meals' ? (
        <>
          {rows.length === 0 && (
            <div className={`card ${styles.empty}`}>
              No food logged for this day yet.
            </div>
          )}

          {rows.length > 0 && (
            <button
              type="button"
              className={styles.loggedToggle}
              aria-expanded={mealsOpen}
              onClick={() => setMealsOpen((o) => !o)}
            >
              <span aria-hidden="true">{mealsOpen ? '▾' : '▸'}</span>{' '}
              {totals.mealCount} meal{totals.mealCount === 1 ? '' : 's'} logged
              {/* The kcal is already in the total card above — what the folded
                  list needs to say is that it's still editable. */}
              {!mealsOpen && <span className={styles.loggedHint}>tap to edit</span>}
            </button>
          )}

          {mealsOpen && rows.map((row, i) => (
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
                {/* The time is stamped when the meal is logged rather than
                    typed: it was always "now" anyway, and the field cost a row
                    on every meal. It still shows, so a wrong one is visible. */}
                {row.time !== '' && <span className={styles.mealTime}>{row.time}</span>}
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
                  <NumericInput
                    decimal={false}
                    className={styles.kcalInput}
                    value={row.calories}
                    ariaLabel={`Meal ${i + 1} calories`}
                    onChange={(v) => updateRow(row.key, { calories: v })}
                  />
                </label>
                <label className={styles.mealField}>
                  <span>protein</span>
                  <NumericInput
                    value={row.protein}
                    ariaLabel={`Meal ${i + 1} protein`}
                    onChange={(v) => updateRow(row.key, { protein: v })}
                  />
                </label>
                <label className={styles.mealField}>
                  <span>carbs</span>
                  <NumericInput
                    value={row.carbs}
                    ariaLabel={`Meal ${i + 1} carbs`}
                    onChange={(v) => updateRow(row.key, { carbs: v })}
                  />
                </label>
                <label className={styles.mealField}>
                  <span>fat</span>
                  <NumericInput
                    value={row.fat}
                    ariaLabel={`Meal ${i + 1} fat`}
                    onChange={(v) => updateRow(row.key, { fat: v })}
                  />
                </label>
                <label className={styles.mealField}>
                  <span>fiber</span>
                  <NumericInput
                    value={row.fiber}
                    ariaLabel={`Meal ${i + 1} fiber`}
                    onChange={(v) => updateRow(row.key, { fiber: v })}
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
                <NumericInput
                  decimal={false}
                  className={styles.kcalInput}
                  value={dayTotal.calories}
                  ariaLabel="Day calories"
                  onChange={(v) => {
                    setDayTotal((d) => ({ ...d, calories: v }));
                    setDirty(true);
                  }}
                />
              </label>
              <label className={styles.mealField}>
                <span>protein</span>
                <NumericInput
                  value={dayTotal.protein}
                  ariaLabel="Day protein"
                  onChange={(v) => {
                    setDayTotal((d) => ({ ...d, protein: v }));
                    setDirty(true);
                  }}
                />
              </label>
              <label className={styles.mealField}>
                <span>carbs</span>
                <NumericInput
                  value={dayTotal.carbs}
                  ariaLabel="Day carbs"
                  onChange={(v) => {
                    setDayTotal((d) => ({ ...d, carbs: v }));
                    setDirty(true);
                  }}
                />
              </label>
              <label className={styles.mealField}>
                <span>fat</span>
                <NumericInput
                  value={dayTotal.fat}
                  ariaLabel="Day fat"
                  onChange={(v) => {
                    setDayTotal((d) => ({ ...d, fat: v }));
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
