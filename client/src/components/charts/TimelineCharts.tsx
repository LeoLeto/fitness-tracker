import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../hooks/useTheme';
import { BandKind, TimelinePayload } from '../../types';
import { addDays, dayDiff, formatShort } from '../../utils/dates';
import { fmtKg } from '../../utils/format';
import { ROUTINE_ORDER, routineLabel } from '../../utils/workouts';
import { useChartColors, useRoutineColors } from './chartTheme';
import { ChartLegend, ChartTooltip } from './ChartTooltip';

/**
 * "Body & Training" timeline: three panels sharing one time axis so
 * cross-domain patterns line up visually —
 *   A. body weight (raw + 7-day avg) with energy-balance bands + event markers
 *   B. strength index per routine (100 = first observed week in range)
 *   C. weekly training sessions (stacked by routine + cardio)
 */

const BAND_FILL: Record<BandKind, { light: string; dark: string }> = {
  'steep-deficit': { light: 'rgba(179, 54, 44, 0.16)', dark: 'rgba(255, 138, 122, 0.16)' },
  deficit: { light: 'rgba(179, 54, 44, 0.08)', dark: 'rgba(255, 138, 122, 0.08)' },
  maintenance: { light: 'rgba(78, 126, 165, 0.07)', dark: 'rgba(114, 163, 196, 0.08)' },
  surplus: { light: 'rgba(30, 126, 79, 0.08)', dark: 'rgba(95, 212, 154, 0.08)' },
  'steep-surplus': { light: 'rgba(30, 126, 79, 0.16)', dark: 'rgba(95, 212, 154, 0.16)' },
};

export const BAND_LABEL: Record<BandKind, string> = {
  'steep-deficit': 'Steep deficit',
  deficit: 'Deficit',
  maintenance: 'Maintenance',
  surplus: 'Surplus',
  'steep-surplus': 'Steep surplus',
};

const EVENT_ICON: Record<string, string> = {
  'training-gap-ended': '🔁',
  'fluid-retention-spike': '💧',
  'recurring-pain': '🚨',
  'weight-spike': '⚠',
};

interface TimelineChartsProps {
  data: TimelinePayload;
}

export function TimelineCharts({ data }: TimelineChartsProps) {
  const colors = useChartColors();
  const routineColor = useRoutineColors();
  const { resolved } = useTheme();

  const { from, to } = data.period;
  const totalDays = Math.max(1, dayDiff(from, to));
  const x = (date: string) => dayDiff(from, date);

  // One shared tick set so all three panels align exactly.
  const ticks = useMemo(() => {
    const count = 6;
    return Array.from({ length: count + 1 }, (_, i) => Math.round((totalDays * i) / count));
  }, [totalDays]);

  const xAxisProps = {
    dataKey: 'x',
    type: 'number' as const,
    domain: [0, totalDays] as [number, number],
    ticks,
    tickFormatter: (v: number) => formatShort(addDays(from, v)),
    tick: { fill: colors.axis, fontSize: 11.5 },
    tickLine: false,
    axisLine: { stroke: colors.grid },
    allowDataOverflow: true,
  };

  // Panel A data: weigh-ins + trailing 7-day average.
  const weightData = useMemo(() => {
    const points = data.weight;
    return points.map((p, i) => {
      const windowStart = addDays(p.date, -6);
      const window = points.slice(Math.max(0, i - 14), i + 1).filter((q) => q.date >= windowStart);
      const ma7 = window.reduce((a, q) => a + q.weightKg, 0) / window.length;
      return { x: x(p.date), date: p.date, weight: p.weightKg, ma7 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.weight, from]);

  const weights = data.weight.map((p) => p.weightKg);
  const weightDomain: [number, number] =
    weights.length > 0
      ? [Math.floor(Math.min(...weights) - 0.5), Math.ceil(Math.max(...weights) + 0.5)]
      : [0, 1];

  // Panel B data: one row per week with a column per routine.
  const routinesInIndex = useMemo(() => {
    const found = new Set<string>();
    for (const week of data.strengthIndex) {
      for (const r of Object.keys(week.byRoutine)) found.add(r);
    }
    const ordered = ROUTINE_ORDER.filter((r) => found.has(r));
    for (const r of [...found].sort()) if (!ordered.includes(r)) ordered.push(r);
    return ordered;
  }, [data.strengthIndex]);

  const strengthData = useMemo(
    () =>
      data.strengthIndex.map((week) => ({
        x: x(week.weekStart) + 3, // plot at mid-week
        date: week.weekStart,
        ...week.byRoutine,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.strengthIndex, from]
  );

  // Panel C data: stacked weekly sessions.
  const routinesInTraining = useMemo(() => {
    const found = new Set<string>();
    for (const week of data.training) {
      for (const r of Object.keys(week.sessions)) found.add(r);
    }
    const ordered = ROUTINE_ORDER.filter((r) => found.has(r));
    for (const r of [...found].sort()) if (!ordered.includes(r)) ordered.push(r);
    return ordered;
  }, [data.training]);

  const trainingData = useMemo(
    () =>
      data.training.map((week) => ({
        x: x(week.weekStart) + 3,
        date: week.weekStart,
        ...week.sessions,
        cardio: week.cardioSessions,
        cardioMin: week.cardioMin,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.training, from]
  );

  const themeKey = resolved === 'dark' ? 'dark' : 'light';

  const weightSeries = {
    weight: { label: 'Weigh-in', format: (v: number) => fmtKg(v), color: colors.rawDot },
    ma7: { label: '7-day avg', format: (v: number) => fmtKg(v, 2), color: colors.weight },
  };

  const strengthSeries = Object.fromEntries(
    routinesInIndex.map((r) => [
      r,
      {
        label: routineLabel(r),
        format: (v: number) => `${v.toFixed(0)} (index)`,
        color: routineColor(r),
      },
    ])
  );

  const trainingSeries = {
    ...Object.fromEntries(
      routinesInTraining.map((r) => [
        r,
        {
          label: routineLabel(r),
          format: (v: number) => `${v} session${v === 1 ? '' : 's'}`,
          color: routineColor(r),
        },
      ])
    ),
    cardio: {
      label: 'Cardio',
      format: (v: number) => `${v} session${v === 1 ? '' : 's'}`,
      color: routineColor('cardio'),
    },
  };

  const dateFromRow = (row: Record<string, unknown> | undefined) =>
    typeof row?.date === 'string' ? (row.date as string) : undefined;

  const barSize = Math.max(6, Math.min(16, Math.floor(420 / Math.max(1, data.training.length))));

  return (
    <div>
      {/* Panel A — body weight with energy-balance bands and events */}
      <ChartLegend
        colors={colors}
        items={[
          { label: 'Weigh-in', color: colors.rawDot, shape: 'dot' },
          { label: '7-day avg', color: colors.weight, shape: 'line' },
        ]}
      />
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={weightData} margin={{ top: 18, right: 8, bottom: 0, left: -14 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          {data.bands.map((band) => (
            <ReferenceArea
              key={`${band.from}-${band.kind}`}
              x1={x(band.from)}
              x2={x(band.to)}
              fill={BAND_FILL[band.kind][themeKey]}
              stroke="none"
            />
          ))}
          <XAxis {...xAxisProps} />
          <YAxis
            domain={weightDomain}
            tick={{ fill: colors.axis, fontSize: 11.5 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip
            content={
              <ChartTooltip series={weightSeries} colors={colors} labelFromPayload={dateFromRow} />
            }
            cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
          />
          {data.events.map((event) => (
            <ReferenceLine
              key={`${event.date}-${event.kind}`}
              x={x(event.date)}
              stroke={colors.axis}
              strokeDasharray="4 4"
              label={{
                value: EVENT_ICON[event.kind] ?? '•',
                position: 'top',
                fontSize: 13,
              }}
            />
          ))}
          <Line
            dataKey="ma7"
            type="monotone"
            stroke={colors.weight}
            strokeWidth={2.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Scatter dataKey="weight" fill={colors.rawDot} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Panel B — strength index per routine */}
      <div style={{ marginTop: 14 }}>
        <ChartLegend
          colors={colors}
          items={routinesInIndex.map((r) => ({
            label: routineLabel(r),
            color: routineColor(r),
            shape: 'line' as const,
          }))}
        />
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart data={strengthData} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: colors.axis, fontSize: 11.5 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              content={
                <ChartTooltip
                  series={strengthSeries}
                  colors={colors}
                  labelFromPayload={(row) =>
                    dateFromRow(row) ? `Week of ${formatShort(dateFromRow(row)!)}` : undefined
                  }
                />
              }
              cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
            />
            <ReferenceLine y={100} stroke={colors.axis} strokeDasharray="4 4" />
            {routinesInIndex.map((r) => (
              <Line
                key={r}
                dataKey={r}
                type="monotone"
                stroke={routineColor(r)}
                strokeWidth={2}
                dot={{ r: 2.5, fill: routineColor(r), strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 12,
            color: colors.textMuted,
          }}
        >
          Strength index: 100 = each exercise's first week in this period (e1RM-based; reps for
          bodyweight work), averaged per routine.
        </p>
      </div>

      {/* Panel C — weekly training sessions */}
      <div style={{ marginTop: 14 }}>
        <ChartLegend
          colors={colors}
          items={[
            ...routinesInTraining.map((r) => ({
              label: routineLabel(r),
              color: routineColor(r),
              shape: 'bar' as const,
            })),
            { label: 'Cardio', color: routineColor('cardio'), shape: 'bar' as const },
          ]}
        />
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={trainingData} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis {...xAxisProps} />
            <YAxis
              allowDecimals={false}
              tick={{ fill: colors.axis, fontSize: 11.5 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              content={
                <ChartTooltip
                  series={trainingSeries}
                  colors={colors}
                  labelFromPayload={(row) =>
                    dateFromRow(row) ? `Week of ${formatShort(dateFromRow(row)!)}` : undefined
                  }
                />
              }
              cursor={{ fill: colors.grid }}
            />
            {routinesInTraining.map((r) => (
              <Bar
                key={r}
                dataKey={r}
                stackId="sessions"
                fill={routineColor(r)}
                barSize={barSize}
                isAnimationActive={false}
              />
            ))}
            <Bar
              dataKey="cardio"
              stackId="sessions"
              fill={routineColor('cardio')}
              barSize={barSize}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
