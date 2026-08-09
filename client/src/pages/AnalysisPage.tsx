import { useState } from 'react';
import { InsightsPanel } from '../components/InsightsPanel';
import { RangePicker, RangeState, defaultRange } from '../components/RangePicker';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimelineCharts } from '../components/charts/TimelineCharts';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { addDays, formatLong, todayStr } from '../utils/dates';
import { countNote, fmtKcal, fmtTrend } from '../utils/format';
import pageStyles from '../styles/page.module.scss';
import styles from './AnalysisPage.module.scss';

type TimelineRange = 'all' | '6m' | '3m' | '28d';
const TIMELINE_DAYS: Record<Exclude<TimelineRange, 'all'>, number> = {
  '6m': 180,
  '3m': 90,
  '28d': 28,
};

export function AnalysisPage() {
  const [range, setRange] = useState<RangeState>(defaultRange());
  const analytics = useApi(() => api.getAnalytics(range.from, range.to), [range.from, range.to]);
  const profile = useApi(() => api.getProfile(), []);

  const [timelineRange, setTimelineRange] = useState<TimelineRange>('all');
  const timelineFrom =
    timelineRange === 'all'
      ? undefined
      : addDays(todayStr(), -(TIMELINE_DAYS[timelineRange] - 1));
  const timeline = useApi(() => api.getTimeline(timelineFrom), [timelineFrom]);
  const [targetDraft, setTargetDraft] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const { toast, show } = useToast();

  const a = analytics.data;
  const m = a?.maintenance;

  const saveTarget = async (value: number | null) => {
    setSavingTarget(true);
    try {
      await api.updateProfile({ calorieTarget: value });
      profile.reload();
      setTargetDraft('');
      show(value != null ? `Calorie target set to ${fmtKcal(value)}` : 'Calorie target cleared');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Failed to save target');
    } finally {
      setSavingTarget(false);
    }
  };

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Analysis</h1>
      </div>

      <section className={`card ${styles.section}`}>
        <div className={styles.timelineHeader}>
          <h2>Body & Training</h2>
          <SegmentedControl<TimelineRange>
            ariaLabel="Timeline range"
            options={[
              { value: 'all', label: 'All' },
              { value: '6m', label: '6m' },
              { value: '3m', label: '3m' },
              { value: '28d', label: '28d' },
            ]}
            value={timelineRange}
            onChange={setTimelineRange}
          />
        </div>
        {timeline.error && <div className={pageStyles.error}>{timeline.error}</div>}
        {timeline.loading && <div className={pageStyles.loading}>Loading…</div>}
        {timeline.data && <TimelineCharts data={timeline.data} />}
      </section>

      {timeline.data && (
        <section className={`card ${styles.section}`}>
          <h2>Insights</h2>
          <InsightsPanel data={timeline.data} />
        </section>
      )}

      <div className={pageStyles.pageHeader}>
        <h2 className={styles.subheading}>Maintenance calories</h2>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {analytics.error && <div className={pageStyles.error}>{analytics.error}</div>}
      {!a && !analytics.error && <div className={pageStyles.loading}>Loading…</div>}

      {a && m && (
        <>
          <section className={`card ${styles.hero}`}>
            <h2 className={styles.heroLabel}>Estimated maintenance</h2>
            {m.sufficient && m.estimatedMaintenanceKcal != null ? (
              <>
                <div className={styles.heroValue}>
                  ~{Math.round(m.estimatedMaintenanceKcal).toLocaleString('en-US')}{' '}
                  <span className={styles.heroUnit}>kcal/day</span>
                </div>
                <p className={styles.disclaimer}>
                  An estimate from your intake and weight trend (1 kg ≈ 7,700 kcal) — not a
                  physiological measurement. It gets more reliable as data accumulates.
                </p>
              </>
            ) : (
              <div className={pageStyles.notice}>
                <strong>Not enough data yet.</strong> Aim for at least 2–3 weeks of reasonably
                consistent data.
                <ul className={styles.reasons}>
                  {m.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <dl className={styles.dataUsed}>
              <div>
                <dt>Data period</dt>
                <dd>
                  {formatLong(m.periodFrom)} – {formatLong(m.periodTo)}
                </dd>
              </div>
              <div>
                <dt>Calorie days</dt>
                <dd>{countNote(m.calorieDays, 'recorded day')}</dd>
              </div>
              <div>
                <dt>Weight measurements</dt>
                <dd>{m.weightMeasurements}</dd>
              </div>
              <div>
                <dt>Weight trend</dt>
                <dd>{fmtTrend(m.trendKgPerWeek)}</dd>
              </div>
              <div>
                <dt>Average intake</dt>
                <dd>{fmtKcal(m.avgCalories)}</dd>
              </div>
              {m.sufficient && (
                <div>
                  <dt>Implied daily surplus</dt>
                  <dd>
                    {m.dailySurplusKcal != null && m.dailySurplusKcal >= 0 ? '+' : ''}
                    {m.dailySurplusKcal} kcal
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className={`card ${styles.section}`}>
            <h2>Recommendation</h2>
            <p className={styles.recommendation}>{a.recommendation.message}</p>
            {m.sufficient && m.suggestedIntakeKcal != null && (
              <p className={styles.suggested}>
                Target gain {fmtTrend(a.target.kgPerWeek, 2)} → suggested intake{' '}
                <strong>~{Math.round(m.suggestedIntakeKcal).toLocaleString('en-US')} kcal/day</strong>{' '}
                (maintenance {m.targetSurplusKcal != null ? `+ ${m.targetSurplusKcal}` : ''} kcal).
              </p>
            )}
          </section>

          <section className={`card ${styles.section}`}>
            <h2>Current calorie target</h2>
            <p className="muted">
              The target you're actually eating to — it only changes when you change it, never
              automatically from a single week's data.
            </p>
            <div className={styles.targetRow}>
              <div className={styles.targetCurrent}>
                {profile.data?.calorieTarget != null
                  ? fmtKcal(profile.data.calorieTarget)
                  : 'Not set'}
              </div>
              {m.sufficient && m.suggestedIntakeKcal != null && (
                <button
                  type="button"
                  className="btn btn--accent"
                  disabled={savingTarget}
                  onClick={() => void saveTarget(m.suggestedIntakeKcal)}
                >
                  Use suggested (~{Math.round(m.suggestedIntakeKcal).toLocaleString('en-US')})
                </button>
              )}
            </div>
            <div className={styles.manualRow}>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Set manually, e.g. 2300"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                disabled={savingTarget || targetDraft.trim() === ''}
                onClick={() => {
                  const n = Number(targetDraft);
                  if (Number.isFinite(n) && n > 0) void saveTarget(Math.round(n));
                }}
              >
                Save
              </button>
            </div>
          </section>
        </>
      )}

      {toast}
    </div>
  );
}
