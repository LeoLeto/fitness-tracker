import { useMemo, useState } from 'react';
import { RangePicker, RangeState, defaultRange } from '../components/RangePicker';
import { StatCard } from '../components/StatCard';
import { CaloriesChart } from '../components/charts/CaloriesChart';
import { CombinedChart } from '../components/charts/CombinedChart';
import { WeightChart } from '../components/charts/WeightChart';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { TrendStatus, WindowStat } from '../types';
import { formatLong } from '../utils/dates';
import {
  STATUS_LABEL,
  countNote,
  fmtGrams,
  fmtGramsPerWeek,
  fmtKcal,
  fmtKg,
  fmtTrend,
} from '../utils/format';
import { buildChartData } from '../utils/movingAverage';
import styles from '../styles/page.module.scss';

function statusPill(status: TrendStatus | null) {
  if (!status) return null;
  const tone = status === 'on-target' ? 'pill--ok' : 'pill--warn';
  return <span className={`pill ${tone}`}>{STATUS_LABEL[status]}</span>;
}

function windowSub(stat: WindowStat, noun: string) {
  return stat.avg == null ? 'no data' : countNote(stat.count, noun);
}

export function DashboardPage() {
  const [range, setRange] = useState<RangeState>(defaultRange());
  const [showMa14, setShowMa14] = useState(false);
  const [showCombined, setShowCombined] = useState(false);

  const analytics = useApi(() => api.getAnalytics(range.from, range.to), [range.from, range.to]);
  const entries = useApi(() => api.listEntries(), []);
  const profile = useApi(() => api.getProfile(), []);
  const weekly = useApi(() => api.getWeekly(), []);

  const thisWeek = weekly.data?.[0];
  const weekSessions = thisWeek
    ? Object.values(thisWeek.sessionsByRoutine).reduce((a, b) => a + b, 0) +
      (thisWeek.cardioMin > 0 ? 1 : 0)
    : 0;
  const weekBreakdown = thisWeek
    ? [
        ...Object.entries(thisWeek.sessionsByRoutine).map(([r, n]) => `${r} ${n}`),
        ...(thisWeek.cardioMin > 0 ? [`cardio ${thisWeek.cardioMin} min`] : []),
      ].join(' · ')
    : '';

  const chartData = useMemo(
    () => (entries.data ? buildChartData(entries.data, range.from, range.to) : []),
    [entries.data, range.from, range.to]
  );

  const a = analytics.data;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Dashboard</h1>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {analytics.error && <div className={styles.error}>{analytics.error}</div>}
      {!a && !analytics.error && <div className={styles.loading}>Loading…</div>}

      {a && (
        <>
          <div className={styles.grid}>
            <StatCard
              label="Current weight"
              value={fmtKg(a.latestWeight?.weightKg ?? null)}
              sub={a.latestWeight ? formatLong(a.latestWeight.date) : 'no weigh-ins yet'}
            />
            <StatCard
              label="7-day average"
              value={fmtKg(a.weight.avg7.avg)}
              sub={windowSub(a.weight.avg7, 'measurement')}
            />
            <StatCard
              label="14-day average"
              value={fmtKg(a.weight.avg14.avg)}
              sub={windowSub(a.weight.avg14, 'measurement')}
            />
            <StatCard
              label="28-day average"
              value={fmtKg(a.weight.avg28.avg)}
              sub={windowSub(a.weight.avg28, 'measurement')}
            />
          </div>

          <div className={styles.grid}>
            <StatCard
              label="Weight trend"
              value={fmtTrend(a.trend?.kgPerWeek ?? null)}
              sub={
                a.trend
                  ? `${fmtGramsPerWeek(a.trend.kgPerWeek)} · ${countNote(
                      a.trend.count,
                      'weigh-in'
                    )} over ${a.trend.spanDays} days`
                  : 'need at least 2 weigh-ins on different days'
              }
              badge={statusPill(a.target.status)}
            />
            <StatCard
              label="Target"
              value={fmtTrend(a.target.kgPerWeek, 2)}
              sub={`on target: ${fmtTrend(
                a.target.kgPerWeek - a.target.toleranceKgPerWeek,
                2
              )} to ${fmtTrend(a.target.kgPerWeek + a.target.toleranceKgPerWeek, 2)}`}
            />
            <StatCard
              label="Training this week"
              value={
                thisWeek
                  ? `${weekSessions} session${weekSessions === 1 ? '' : 's'}`
                  : '—'
              }
              sub={weekBreakdown || 'nothing logged yet'}
            />
          </div>

          <div className={`card ${styles.chartCard}`}>
            <div className={styles.chartHeader}>
              <h2>Weight</h2>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showMa14}
                  onChange={(e) => setShowMa14(e.target.checked)}
                />
                14-day average
              </label>
            </div>
            <WeightChart data={chartData} showMa14={showMa14} />
          </div>

          <h2 className={styles.sectionTitle}>Calories</h2>
          <div className={styles.grid}>
            <StatCard
              label="7-day avg"
              value={fmtKcal(a.calories.avg7.avg)}
              sub={windowSub(a.calories.avg7, 'recorded day')}
            />
            <StatCard
              label="14-day avg"
              value={fmtKcal(a.calories.avg14.avg)}
              sub={windowSub(a.calories.avg14, 'recorded day')}
            />
            <StatCard
              label="28-day avg"
              value={fmtKcal(a.calories.avg28.avg)}
              sub={windowSub(a.calories.avg28, 'recorded day')}
            />
            <StatCard
              label="Protein avg"
              value={fmtGrams(a.macros.protein.avg)}
              sub={windowSub(a.macros.protein, 'recorded day')}
            />
            <StatCard
              label="Carbs avg"
              value={fmtGrams(a.macros.carbs.avg)}
              sub={windowSub(a.macros.carbs, 'recorded day')}
            />
            <StatCard
              label="Fat avg"
              value={fmtGrams(a.macros.fat.avg)}
              sub={windowSub(a.macros.fat, 'recorded day')}
            />
          </div>

          <div className={`card ${styles.chartCard}`}>
            <div className={styles.chartHeader}>
              <h2>Daily intake</h2>
            </div>
            <CaloriesChart
              data={chartData}
              averageKcal={a.calories.avg28.avg}
              targetKcal={profile.data?.calorieTarget ?? null}
            />
          </div>

          <div className={`card ${styles.chartCard}`}>
            <div className={styles.chartHeader}>
              <h2>Weight vs calories</h2>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showCombined}
                  onChange={(e) => setShowCombined(e.target.checked)}
                />
                Show combined view
              </label>
            </div>
            {showCombined && <CombinedChart data={chartData} />}
          </div>
        </>
      )}
    </div>
  );
}
