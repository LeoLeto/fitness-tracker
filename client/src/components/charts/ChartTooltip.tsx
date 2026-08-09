import { ChartColors } from './chartTheme';
import { formatMedium } from '../../utils/dates';

interface SeriesFormat {
  label: string;
  format: (value: number) => string;
  color: string;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | string | Array<number | string>;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  series: Record<string, SeriesFormat>;
  colors: ChartColors;
  /** For numeric x-axes: derive the header (e.g. a date) from the row data. */
  labelFromPayload?: (row: Record<string, unknown> | undefined) => string | undefined;
}

/** Shared tooltip: date header + one row per series present on that day. */
export function ChartTooltip({
  active,
  label,
  payload,
  series,
  colors,
  labelFromPayload,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter(
    (item) => item.dataKey && typeof item.value === 'number' && series[String(item.dataKey)]
  );
  if (rows.length === 0) return null;
  const derived = labelFromPayload?.(payload[0]?.payload);
  if (derived !== undefined) label = derived;

  return (
    <div
      style={{
        background: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 13,
        color: colors.text,
        boxShadow: '0 4px 16px rgba(1, 25, 50, 0.18)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {typeof label === 'string' ? formatMedium(label) : label}
      </div>
      {rows.map((item) => {
        const key = String(item.dataKey);
        const s = series[key];
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: s.color,
                display: 'inline-block',
              }}
            />
            <span style={{ color: colors.textMuted }}>{s.label}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, paddingLeft: 12 }}>
              {s.format(item.value as number)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface LegendItem {
  label: string;
  color: string;
  shape?: 'line' | 'dashed' | 'dot' | 'bar';
}

/** Text stays in text tokens; the colored mark carries identity. */
export function ChartLegend({ items, colors }: { items: LegendItem[]; colors: ChartColors }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 16px',
        fontSize: 12.5,
        color: colors.textMuted,
        marginBottom: 4,
      }}
    >
      {items.map((item) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <LegendMark color={item.color} shape={item.shape ?? 'line'} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function LegendMark({ color, shape }: { color: string; shape: 'line' | 'dashed' | 'dot' | 'bar' }) {
  if (shape === 'dot') {
    return (
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: '50%', background: color }}
      />
    );
  }
  if (shape === 'bar') {
    return (
      <span
        aria-hidden="true"
        style={{ width: 10, height: 10, borderRadius: 3, background: color }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: 16,
        height: 0,
        borderTop: shape === 'dashed' ? `2px dashed ${color}` : `2px solid ${color}`,
        display: 'inline-block',
      }}
    />
  );
}
