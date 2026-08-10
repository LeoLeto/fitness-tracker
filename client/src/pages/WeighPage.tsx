import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DayNav } from '../components/DayNav';
import {
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
import { formatMedium, formatShort, todayStr } from '../utils/dates';
import { fmtKg } from '../utils/format';
import { parseDecimal } from '../utils/numeric';
import pageStyles from '../styles/page.module.scss';
import styles from './WeighPage.module.scss';

interface FormState {
  weight: string;
  weighedTime: string;
  beforeFood: TriState;
  afterBowelMovement: TriState;
  bowelMovement: TriState;
  trained: TriState;
  notes: string;
}

const EMPTY_FORM: FormState = {
  weight: '',
  weighedTime: '',
  beforeFood: 'unset',
  afterBowelMovement: 'unset',
  bowelMovement: 'unset',
  trained: 'unset',
  notes: '',
};

function formFromEntry(entry: DailyEntry): FormState {
  return {
    weight: entry.weightKg != null ? String(entry.weightKg) : '',
    weighedTime: entry.weighedTime ?? '',
    beforeFood: boolToTriState(entry.beforeFood),
    afterBowelMovement: boolToTriState(entry.afterBowelMovement),
    bowelMovement: boolToTriState(entry.bowelMovement),
    trained: boolToTriState(entry.trained),
    notes: entry.notes ?? '',
  };
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function WeighPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramDate = searchParams.get('date');
  const date = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : todayStr();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [existing, setExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show } = useToast();

  const allEntries = useApi(() => api.listEntries(), []);

  // Previous weigh-in: shown as a placeholder hint and a reference line —
  // never saved unless typed, so it can't leak into today's record.
  const previous = useMemo(() => {
    const before = (allEntries.data ?? []).filter((e) => e.date < date && e.weightKg != null);
    return before.length > 0 ? before[before.length - 1] : null;
  }, [allEntries.data, date]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .getEntry(date)
      .then((entry) => {
        if (cancelled) return;
        setForm(entry ? formFromEntry(entry) : EMPTY_FORM);
        setExisting(entry !== null && entry.weightKg != null);
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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const weightKg = parseDecimal(form.weight);
    if (weightKg === undefined) {
      setError('Weight is not a valid number.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // PATCH: only the weigh-in slice of the day, so meals stay untouched.
      await api.patchEntry(date, {
        weightKg,
        weighedTime: form.weighedTime.trim() === '' ? null : form.weighedTime,
        beforeFood: triStateToBool(form.beforeFood),
        afterBowelMovement: triStateToBool(form.afterBowelMovement),
        bowelMovement: triStateToBool(form.bowelMovement),
        trained: triStateToBool(form.trained),
        notes: form.notes.trim() === '' ? null : form.notes.trim(),
      });
      setExisting(weightKg !== null);
      allEntries.reload();
      show(`Saved ${formatMedium(date)} ✓`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const typedWeight = parseDecimal(form.weight);
  const delta =
    previous?.weightKg != null && typeof typedWeight === 'number'
      ? typedWeight - previous.weightKg
      : null;

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Weigh-in</h1>
      </div>

      <DayNav
        date={date}
        onChange={(next) => setSearchParams({ date: next })}
        hint={existing ? <span className={styles.savedBadge}> · saved</span> : null}
        sibling={<Link to={`/food?date=${date}`}>Food for this day →</Link>}
      />

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className={`card ${styles.section}`}>
          <NumberField
            big
            label="Body weight"
            unit="kg"
            value={form.weight}
            onChange={(v) => set('weight', v)}
            placeholder={previous?.weightKg != null ? String(previous.weightKg) : 'e.g. 63.7'}
            mode="decimal"
          />
          {previous?.weightKg != null && (
            <p className={styles.previous}>
              Previous: {fmtKg(previous.weightKg)} on {formatShort(previous.date)}
              {delta !== null && (
                <span className={delta >= 0 ? styles.deltaUp : styles.deltaDown}>
                  {' '}
                  {delta >= 0 ? '+' : ''}
                  {delta.toFixed(1)} kg
                </span>
              )}
            </p>
          )}
        </section>

        {/* Conditions are always visible — they are optional context, and a
            measurement is never invalidated by leaving them blank. */}
        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionHeading}>Conditions (all optional)</h2>
          <div className={styles.timeRow}>
            <TextField
              label="Time weighed"
              type="time"
              value={form.weighedTime}
              onChange={(v) => set('weighedTime', v)}
            />
            <button
              type="button"
              className={styles.nowBtn}
              onClick={() => set('weighedTime', currentTime())}
            >
              Now
            </button>
          </div>
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
          <TriStateField
            label="Bowel movement today"
            hint="(context for weight fluctuations)"
            value={form.bowelMovement}
            onChange={(v) => set('bowelMovement', v)}
          />
        </section>

        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionHeading}>Day context</h2>
          <TriStateField
            label="Trained today"
            hint="(log sets on the Train tab)"
            value={form.trained}
            onChange={(v) => set('trained', v)}
          />
          <label className={styles.notesField}>
            <span>Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="e.g. Ate very salty food, poor sleep, travel…"
            />
          </label>
        </section>

        {error && <div className={pageStyles.error}>{error}</div>}

        <button type="submit" className="btn btn--accent" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Update weigh-in' : 'Save weigh-in'}
        </button>
      </form>

      {toast}
    </div>
  );
}
