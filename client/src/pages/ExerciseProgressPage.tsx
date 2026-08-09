import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tickInterval, useChartColors } from '../components/charts/chartTheme';
import { ChartLegend, ChartTooltip } from '../components/charts/ChartTooltip';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { addDays, dayDiff, formatShort } from '../utils/dates';
import { routineLabel } from '../utils/workouts';
import pageStyles from '../styles/page.module.scss';
import styles from './ExerciseProgressPage.module.scss';

export function ExerciseProgressPage() {
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') ?? '';
  const routine = searchParams.get('routine') ?? '';

  const series = useApi(() => api.getStrengthSeries(name), [name]);
  const colors = useChartColors();

  const points = series.data?.points ?? [];
  const isBodyweight = points.length > 0 && points.every((p) => p.e1rm === null);

  const chartData = useMemo(() => {
    if (points.length === 0) return [];
    const first = points[0].date;
    return points.map((p) => {
      const metric = p.e1rm ?? p.bestReps;
      return {
        x: dayDiff(first, p.date),
        date: p.date,
        metric,
        pain: p.hadPain ? metric : undefined,
        badForm: p.hadBadForm && !p.hadPain ? metric : undefined,
      };
    });
  }, [points]);

  const firstDate = points[0]?.date;
  const metricLabel = isBodyweight ? 'Best reps (incl. RIR)' : 'Est. 1RM';
  const fmtMetric = (v: number) => (isBodyweight ? `${Math.round(v)} reps` : `${v.toFixed(1)} kg`);

  const seriesFormats = {
    metric: { label: metricLabel, format: fmtMetric, color: colors.weight },
    pain: { label: 'Pain-flagged session 🚨', format: fmtMetric, color: '#c0392b' },
    badForm: { label: 'Form flagged ✱', format: fmtMetric, color: colors.calories },
  };

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <Link to={`/train?routine=${encodeURIComponent(routine)}`} className={styles.back}>
          ‹ Back to Train
        </Link>
        <h1>{name}</h1>
        {routine && <p className="muted">{routineLabel(routine)} routine</p>}
      </div>

      {series.error && <div className={pageStyles.error}>{series.error}</div>}
      {series.loading && <div className={pageStyles.loading}>Loading…</div>}

      {!series.loading && points.length === 0 && (
        <div className="card">No sessions logged for this exercise yet.</div>
      )}

      {points.length > 1 && firstDate && (
        <div className={`card ${pageStyles.chartCard}`}>
          <div className={pageStyles.chartHeader}>
            <h2>{metricLabel} over time</h2>
          </div>
          <ChartLegend
            colors={colors}
            items={[
              { label: metricLabel, color: colors.weight, shape: 'line' },
              { label: 'Pain 🚨', color: '#c0392b', shape: 'dot' },
              { label: 'Bad form ✱', color: colors.calories, shape: 'dot' },
            ]}
          />
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, chartData[chartData.length - 1].x]}
                tickFormatter={(v: number) => formatShort(addDays(firstDate, v))}
                interval={tickInterval(chartData.length)}
                tick={{ fill: colors.axis, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: colors.axis, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={46}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    series={seriesFormats}
                    colors={colors}
                    labelFromPayload={(payload) => payload?.date as string | undefined}
                  />
                }
                cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
              />
              <Line
                dataKey="metric"
                type="monotone"
                stroke={colors.weight}
                strokeWidth={2.5}
                dot={{ r: 3, fill: colors.weight, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Scatter dataKey="pain" fill="#c0392b" isAnimationActive={false} />
              <Scatter dataKey="badForm" fill={colors.calories} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className={styles.note}>
            {isBodyweight
              ? 'Bodyweight exercise: tracked by the best set\'s reps + reps in reserve.'
              : 'Estimated 1RM (Epley, RIR-adjusted): weight × (1 + (reps + RIR) / 30), best set per session.'}
          </p>
        </div>
      )}

      {points.length > 0 && (
        <div className={`card ${styles.tableCard}`}>
          <h2>Sessions</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>{isBodyweight ? 'Best reps' : 'e1RM'}</th>
                  <th>Top kg</th>
                  <th>Sets</th>
                  <th>Volume</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{formatShort(p.date)}</td>
                    <td>{p.e1rm != null ? p.e1rm.toFixed(1) : p.bestReps}</td>
                    <td>{p.topWeightKg ?? 'BW'}</td>
                    <td>{p.totalSets}</td>
                    <td>{p.volumeKg > 0 ? Math.round(p.volumeKg) : '—'}</td>
                    <td>
                      {p.hadPain && '🚨'}
                      {p.hadBadForm && '✱'}
                      {p.variation && <span className={styles.variation}> {p.variation}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
