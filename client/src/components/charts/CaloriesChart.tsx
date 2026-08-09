import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartPoint } from '../../utils/movingAverage';
import { formatShort } from '../../utils/dates';
import { fmtKcal } from '../../utils/format';
import { tickInterval, useChartColors } from './chartTheme';
import { ChartLegend, ChartTooltip } from './ChartTooltip';

interface CaloriesChartProps {
  data: ChartPoint[];
  /** Average intake over the selected period (only from recorded days). */
  averageKcal: number | null;
  /** Manually set daily calorie target, if any. */
  targetKcal: number | null;
}

/** Daily calorie bars with the period average (and optional target) overlaid. */
export function CaloriesChart({ data, averageKcal, targetKcal }: CaloriesChartProps) {
  const colors = useChartColors();

  if (!data.some((p) => p.calories != null)) {
    return <p className="muted">No calorie data in this period yet.</p>;
  }

  const series = {
    calories: { label: 'Calories', format: fmtKcal, color: colors.calories },
  };

  return (
    <div>
      <ChartLegend
        colors={colors}
        items={[
          { label: 'Daily intake', color: colors.caloriesBar, shape: 'bar' },
          ...(averageKcal != null
            ? [{ label: `Avg ${fmtKcal(averageKcal)}`, color: colors.calories, shape: 'line' as const }]
            : []),
          ...(targetKcal != null
            ? [{ label: `Target ${fmtKcal(targetKcal)}`, color: colors.targetLine, shape: 'dashed' as const }]
            : []),
        ]}
      />
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShort}
            interval={tickInterval(data.length)}
            tick={{ fill: colors.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
          />
          <YAxis
            tick={{ fill: colors.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            content={<ChartTooltip series={series} colors={colors} />}
            cursor={{ fill: colors.grid }}
          />
          <Bar
            dataKey="calories"
            fill={colors.caloriesBar}
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
            isAnimationActive={false}
          />
          {averageKcal != null && (
            <ReferenceLine y={averageKcal} stroke={colors.calories} strokeWidth={2} />
          )}
          {targetKcal != null && (
            <ReferenceLine
              y={targetKcal}
              stroke={colors.targetLine}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
