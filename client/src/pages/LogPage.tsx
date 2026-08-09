import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FieldRow,
  NumberField,
  TextField,
  TriState,
  TriStateField,
  boolToTriState,
  triStateToBool,
} from '../components/fields';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { DailyEntry } from '../types';
import { addDays, formatMedium, todayStr } from '../utils/dates';
import pageStyles from '../styles/page.module.scss';
import styles from './LogPage.module.scss';

interface FormState {
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  bowelMovement: TriState;
  weighedTime: string;
  beforeFood: TriState;
  afterBowelMovement: TriState;
  trained: TriState;
  trainingType: string;
  trainingDuration: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  weight: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  bowelMovement: 'unset',
  weighedTime: '',
  beforeFood: 'unset',
  afterBowelMovement: 'unset',
  trained: 'unset',
  trainingType: '',
  trainingDuration: '',
  notes: '',
};

function formFromEntry(entry: DailyEntry): FormState {
  return {
    weight: entry.weightKg != null ? String(entry.weightKg) : '',
    calories: entry.calories != null ? String(entry.calories) : '',
    protein: entry.proteinG != null ? String(entry.proteinG) : '',
    carbs: entry.carbsG != null ? String(entry.carbsG) : '',
    fat: entry.fatG != null ? String(entry.fatG) : '',
    bowelMovement: boolToTriState(entry.bowelMovement),
    weighedTime: entry.weighedTime ?? '',
    beforeFood: boolToTriState(entry.beforeFood),
    afterBowelMovement: boolToTriState(entry.afterBowelMovement),
    trained: boolToTriState(entry.trained),
    trainingType: entry.trainingType ?? '',
    trainingDuration: entry.trainingDurationMin != null ? String(entry.trainingDurationMin) : '',
    notes: entry.notes ?? '',
  };
}

/** '' → null (not recorded); comma decimals accepted. Returns 'invalid' for garbage. */
function parseNum(s: string): number | null | 'invalid' {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : 'invalid';
}

export function LogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramDate = searchParams.get('date');
  const date = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : todayStr();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [existing, setExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show } = useToast();

  // Placeholders show the last-used values as hints only — they are never
  // saved unless typed, so today's numbers can't leak into tomorrow's record.
  const allEntries = useApi(() => api.listEntries(), []);
  const placeholders = useMemo(() => {
    const before = (allEntries.data ?? []).filter((e) => e.date < date);
    const lastWeight = [...before].reverse().find((e) => e.weightKg != null);
    const lastCalories = [...before].reverse().find((e) => e.calories != null);
    const lastProtein = [...before].reverse().find((e) => e.proteinG != null);
    const lastTraining = [...before].reverse().find((e) => e.trainingType);
    return {
      weight: lastWeight?.weightKg != null ? `last: ${lastWeight.weightKg}` : 'e.g. 63.7',
      calories: lastCalories?.calories != null ? `last: ${lastCalories.calories}` : 'e.g. 2015',
      protein: lastProtein?.proteinG != null ? `last: ${lastProtein.proteinG}` : 'e.g. 145',
      trainingType: lastTraining?.trainingType ?? 'e.g. Upper / Push / Legs',
    };
  }, [allEntries.data, date]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .getEntry(date)
      .then((entry) => {
        if (cancelled) return;
        setForm(entry ? formFromEntry(entry) : EMPTY_FORM);
        setExisting(entry !== null);
      })
      .catch(() => {
        if (cancelled) return;
        setForm(EMPTY_FORM);
        setExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const setDate = (next: string) => setSearchParams({ date: next });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const numbers = {
      weightKg: parseNum(form.weight),
      calories: parseNum(form.calories),
      proteinG: parseNum(form.protein),
      carbsG: parseNum(form.carbs),
      fatG: parseNum(form.fat),
      trainingDurationMin: parseNum(form.trainingDuration),
    };
    const bad = Object.entries(numbers).find(([, v]) => v === 'invalid');
    if (bad) {
      setError('Please check the numeric fields — one of them is not a valid number.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const entry: DailyEntry = {
        date,
        weightKg: numbers.weightKg as number | null,
        calories: numbers.calories as number | null,
        proteinG: numbers.proteinG as number | null,
        carbsG: numbers.carbsG as number | null,
        fatG: numbers.fatG as number | null,
        bowelMovement: triStateToBool(form.bowelMovement),
        weighedTime: form.weighedTime.trim() === '' ? null : form.weighedTime,
        beforeFood: triStateToBool(form.beforeFood),
        afterBowelMovement: triStateToBool(form.afterBowelMovement),
        trained: triStateToBool(form.trained),
        trainingType: form.trainingType.trim() === '' ? null : form.trainingType.trim(),
        trainingDurationMin: numbers.trainingDurationMin as number | null,
        notes: form.notes.trim() === '' ? null : form.notes.trim(),
      };
      await api.saveEntry(entry);
      setExisting(true);
      allEntries.reload();
      show(`Saved ${formatMedium(date)} ✓`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Log</h1>
      </div>

      <div className={`card ${styles.dateCard}`}>
        <button
          type="button"
          className={styles.dayArrow}
          aria-label="Previous day"
          onClick={() => setDate(addDays(date, -1))}
        >
          ‹
        </button>
        <div className={styles.dateCenter}>
          <input
            type="date"
            value={date}
            max={todayStr()}
            aria-label="Entry date"
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={styles.dateInput}
          />
          <span className={styles.dateHuman}>
            {date === todayStr() ? 'Today' : formatMedium(date)}
            {existing && <span className={styles.editingBadge}> · editing saved entry</span>}
          </span>
        </div>
        <button
          type="button"
          className={styles.dayArrow}
          aria-label="Next day"
          disabled={date >= todayStr()}
          onClick={() => setDate(addDays(date, 1))}
        >
          ›
        </button>
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionHeading}>Weight</h2>
          <NumberField
            big
            label="Body weight"
            unit="kg"
            value={form.weight}
            onChange={(v) => set('weight', v)}
            placeholder={placeholders.weight}
            mode="decimal"
            step="0.1"
          />
          <details className={styles.details}>
            <summary>Weigh-in conditions (optional)</summary>
            <div className={styles.detailsBody}>
              <TextField
                label="Time weighed"
                type="time"
                value={form.weighedTime}
                onChange={(v) => set('weighedTime', v)}
              />
              <TriStateField
                label="Before food/drink"
                value={form.beforeFood}
                onChange={(v) => set('beforeFood', v)}
              />
              <TriStateField
                label="After bowel movement"
                value={form.afterBowelMovement}
                onChange={(v) => set('afterBowelMovement', v)}
              />
            </div>
          </details>
        </section>

        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionHeading}>Nutrition</h2>
          <NumberField
            big
            label="Calories"
            unit="kcal"
            value={form.calories}
            onChange={(v) => set('calories', v)}
            placeholder={placeholders.calories}
            mode="numeric"
          />
          <FieldRow>
            <NumberField
              label="Protein"
              unit="g"
              value={form.protein}
              onChange={(v) => set('protein', v)}
              placeholder={placeholders.protein}
              mode="numeric"
            />
            <NumberField
              label="Carbs"
              unit="g"
              value={form.carbs}
              onChange={(v) => set('carbs', v)}
              mode="numeric"
            />
            <NumberField
              label="Fat"
              unit="g"
              value={form.fat}
              onChange={(v) => set('fat', v)}
              mode="numeric"
            />
          </FieldRow>
        </section>

        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionHeading}>Training</h2>
          <TriStateField
            label="Trained today"
            value={form.trained}
            onChange={(v) => set('trained', v)}
          />
          {form.trained === 'yes' && (
            <FieldRow>
              <TextField
                label="Session type"
                value={form.trainingType}
                onChange={(v) => set('trainingType', v)}
                placeholder={placeholders.trainingType}
              />
              <NumberField
                label="Duration"
                unit="min"
                value={form.trainingDuration}
                onChange={(v) => set('trainingDuration', v)}
                mode="numeric"
              />
            </FieldRow>
          )}
        </section>

        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionHeading}>Context</h2>
          <TriStateField
            label="Bowel movement"
            hint="(context for weight fluctuations)"
            value={form.bowelMovement}
            onChange={(v) => set('bowelMovement', v)}
          />
          <label className={styles.notesField}>
            <span>Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="e.g. Ate very salty food, restaurant meal, poor sleep…"
            />
          </label>
        </section>

        {error && <div className={pageStyles.error}>{error}</div>}

        <button type="submit" className="btn btn--accent" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Update entry' : 'Save entry'}
        </button>
      </form>

      {toast}
    </div>
  );
}
