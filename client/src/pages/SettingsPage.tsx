import { useEffect, useState } from 'react';
import { SegmentedControl } from '../components/SegmentedControl';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { ThemeChoice, useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { Profile } from '../types';
import pageStyles from '../styles/page.module.scss';
import styles from './SettingsPage.module.scss';

interface FormState {
  sex: Profile['sex'];
  age: string;
  heightCm: string;
  goal: string;
  targetWeightChangeKgPerWeek: string;
  trainingDaysPerWeek: string;
  cardio: 'yes' | 'no';
  maintenanceCalories: string;
  calorieTarget: string;
  notes: string;
}

function formFromProfile(p: Profile): FormState {
  return {
    sex: p.sex,
    age: String(p.age),
    heightCm: String(p.heightCm),
    goal: p.goal,
    targetWeightChangeKgPerWeek: String(p.targetWeightChangeKgPerWeek),
    trainingDaysPerWeek: String(p.trainingDaysPerWeek),
    cardio: p.cardio ? 'yes' : 'no',
    maintenanceCalories: p.maintenanceCalories != null ? String(p.maintenanceCalories) : '',
    calorieTarget: p.calorieTarget != null ? String(p.calorieTarget) : '',
    notes: p.notes,
  };
}

export function SettingsPage() {
  const profile = useApi(() => api.getProfile(), []);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show } = useToast();
  const { choice, setChoice } = useTheme();

  useEffect(() => {
    if (profile.data) setForm(formFromProfile(profile.data));
  }, [profile.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;
    const num = (s: string) => {
      const n = Number(s.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    const age = num(form.age);
    const height = num(form.heightCm);
    const target = num(form.targetWeightChangeKgPerWeek);
    const trainingDays = num(form.trainingDaysPerWeek);
    if (age == null || height == null || target == null || trainingDays == null) {
      setError('Age, height, target change and training days must be valid numbers.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.updateProfile({
        sex: form.sex,
        age,
        heightCm: height,
        goal: form.goal,
        targetWeightChangeKgPerWeek: target,
        trainingDaysPerWeek: trainingDays,
        cardio: form.cardio === 'yes',
        maintenanceCalories:
          form.maintenanceCalories.trim() === '' ? null : num(form.maintenanceCalories),
        calorieTarget: form.calorieTarget.trim() === '' ? null : num(form.calorieTarget),
        notes: form.notes,
      });
      profile.reload();
      show('Profile saved ✓');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Settings</h1>
      </div>

      <section className={`card ${styles.section}`}>
        <h2>Appearance</h2>
        <SegmentedControl<ThemeChoice>
          ariaLabel="Theme"
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={choice}
          onChange={setChoice}
        />
      </section>

      {profile.error && <div className={pageStyles.error}>{profile.error}</div>}
      {!form && !profile.error && <div className={pageStyles.loading}>Loading…</div>}

      {form && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <section className={`card ${styles.section}`}>
            <h2>Profile</h2>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Sex</span>
                <select
                  value={form.sex}
                  onChange={(e) => set('sex', e.target.value as Profile['sex'])}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Age</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.age}
                  onChange={(e) => set('age', e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Height (cm)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.heightCm}
                  onChange={(e) => set('heightCm', e.target.value)}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Current goal</span>
              <input
                type="text"
                value={form.goal}
                onChange={(e) => set('goal', e.target.value)}
                placeholder="e.g. Lean bulk"
              />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Target weight change (kg/week)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  value={form.targetWeightChangeKgPerWeek}
                  onChange={(e) => set('targetWeightChangeKgPerWeek', e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Training days / week</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={form.trainingDaysPerWeek}
                  onChange={(e) => set('trainingDaysPerWeek', e.target.value)}
                />
              </label>
            </div>
            <div className={styles.field}>
              <span>Cardio</span>
              <SegmentedControl<'yes' | 'no'>
                ariaLabel="Cardio"
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
                value={form.cardio}
                onChange={(v) => set('cardio', v)}
              />
            </div>
          </section>

          <section className={`card ${styles.section}`}>
            <h2>Calories</h2>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Estimated maintenance (kcal, optional)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.maintenanceCalories}
                  onChange={(e) => set('maintenanceCalories', e.target.value)}
                  placeholder="from Analysis"
                />
              </label>
              <label className={styles.field}>
                <span>Current calorie target (kcal, optional)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.calorieTarget}
                  onChange={(e) => set('calorieTarget', e.target.value)}
                  placeholder="e.g. 2300"
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Notes</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>
          </section>

          {error && <div className={pageStyles.error}>{error}</div>}

          <button type="submit" className="btn btn--accent" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}

      <p className={styles.footnote}>
        Private personal instance — no authentication. Don't expose this app publicly without
        adding auth.
      </p>

      {toast}
    </div>
  );
}
