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
import { ChartPoint } from '../../utils/movingAverage';
import { formatShort } from '../../utils/dates';
import { fmtKg } from '../../utils/format';
import { tickInterval, useChartColors } from './chartTheme';
import { ChartLegend, ChartTooltip } from './ChartTooltip';

interface WeightChartProps {
  data: ChartPoint[];
  showMa14: boolean;
}

/**
 * Raw weigh-ins as points (kept visible so fluctuations stay honest) with
 * 7-day and optional 14-day moving-average lines on a true calendar x-axis.
 */
export function WeightChart({ data, showMa14 }: WeightChartProps) {
  const colors = useChartColors();

  const weights = data.filter((p) => p.weight != null).map((p) => p.weight as number);
  if (weights.length === 0) {
    return <p className="muted">No weight data in this period yet.</p>;
  }
  // Weight varies in a narrow band — pad the domain instead of starting at 0.
  const min = Math.floor((Math.min(...weights) - 0.4) * 10) / 10;
  const max = Math.ceil((Math.max(...weights) + 0.4) * 10) / 10;

  const series = {
    weight: { label: 'Weigh-in', format: (v: number) => fmtKg(v), color: colors.rawDot },
    ma7: { label: '7-day avg', format: (v: number) => fmtKg(v, 2), color: colors.weight },
    ma14: { label: '14-day avg', format: (v: number) => fmtKg(v, 2), color: colors.weightMa14 },
  };

  return (
    <div>
      <ChartLegend
        colors={colors}
        items={[
          { label: 'Weigh-in', color: colors.rawDot, shape: 'dot' },
          { label: '7-day avg', color: colors.weight, shape: 'line' },
          ...(showMa14
            ? [{ label: '14-day avg', color: colors.weightMa14, shape: 'dashed' as const }]
            : []),
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
            domain={[min, max]}
            tick={{ fill: colors.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip
            content={<ChartTooltip series={series} colors={colors} />}
            cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
          />
          {showMa14 && (
            <Line
              dataKey="ma14"
              type="monotone"
              stroke={colors.weightMa14}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
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
    </div>
  );
}
