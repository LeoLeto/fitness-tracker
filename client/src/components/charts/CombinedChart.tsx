import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartPoint } from '../../utils/movingAverage';
import { formatShort } from '../../utils/dates';
import { fmtKcal, fmtKg } from '../../utils/format';
import { tickInterval, useChartColors } from './chartTheme';
import { ChartLegend, ChartTooltip } from './ChartTooltip';

/**
 * Combined view: weight (7-day avg + raw weigh-ins) on the primary/left axis,
 * calories on the secondary/right axis. Each axis is tinted to match its
 * series so there's no ambiguity about which scale belongs to which measure.
 */
export function CombinedChart({ data }: { data: ChartPoint[] }) {
  const colors = useChartColors();

  const weights = data.filter((p) => p.weight != null).map((p) => p.weight as number);
  if (weights.length === 0 && !data.some((p) => p.calories != null)) {
    return <p className="muted">No data in this period yet.</p>;
  }
  const min = weights.length > 0 ? Math.floor((Math.min(...weights) - 0.4) * 10) / 10 : 0;
  const max = weights.length > 0 ? Math.ceil((Math.max(...weights) + 0.4) * 10) / 10 : 1;

  const series = {
    weight: { label: 'Weigh-in', format: (v: number) => fmtKg(v), color: colors.rawDot },
    ma7: { label: 'Weight 7-day avg', format: (v: number) => fmtKg(v, 2), color: colors.weight },
    calories: { label: 'Calories', format: fmtKcal, color: colors.calories },
  };

  return (
    <div>
      <ChartLegend
        colors={colors}
        items={[
          { label: 'Weight 7-day avg (kg, left)', color: colors.weight, shape: 'line' },
          { label: 'Weigh-in', color: colors.rawDot, shape: 'dot' },
          { label: 'Calories (kcal, right)', color: colors.caloriesBar, shape: 'bar' },
        ]}
      />
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: -6, bottom: 0, left: -12 }}>
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
            yAxisId="weight"
            domain={[min, max]}
            tick={{ fill: colors.weight, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <YAxis
            yAxisId="calories"
            orientation="right"
            tick={{ fill: colors.calories, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip
            content={<ChartTooltip series={series} colors={colors} />}
            cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
          />
          <Bar
            yAxisId="calories"
            dataKey="calories"
            fill={colors.caloriesBar}
            fillOpacity={0.45}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
          <Line
            yAxisId="weight"
            dataKey="ma7"
            type="monotone"
            stroke={colors.weight}
            strokeWidth={2.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Scatter yAxisId="weight" dataKey="weight" fill={colors.rawDot} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
