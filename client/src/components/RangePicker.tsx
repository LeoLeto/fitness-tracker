import { RANGE_PRESETS, rangeForPreset, todayStr } from '../utils/dates';
import styles from './RangePicker.module.scss';

export interface RangeState {
  preset: string;
  from: string;
  to: string;
}

export function defaultRange(presetKey = '28d'): RangeState {
  const preset = RANGE_PRESETS.find((p) => p.key === presetKey) ?? RANGE_PRESETS[2];
  const { from, to } = rangeForPreset(preset.days ?? 28);
  return { preset: preset.key, from, to };
}

interface RangePickerProps {
  value: RangeState;
  onChange: (value: RangeState) => void;
}

/** Quick period selection: 7d / 14d / 28d / 3m / 6m / 1y / custom. */
export function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div className={styles.picker}>
      <div className={styles.presets} role="group" aria-label="Date range">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={
              value.preset === preset.key ? `${styles.chip} ${styles.chipActive}` : styles.chip
            }
            onClick={() => {
              if (preset.days === null) {
                onChange({ ...value, preset: 'custom' });
              } else {
                const range = rangeForPreset(preset.days);
                onChange({ preset: preset.key, ...range });
              }
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className={styles.custom}>
          <label className={styles.customField}>
            <span>From</span>
            <input
              type="date"
              value={value.from}
              max={value.to}
              onChange={(e) =>
                e.target.value && onChange({ ...value, from: e.target.value })
              }
            />
          </label>
          <label className={styles.customField}>
            <span>To</span>
            <input
              type="date"
              value={value.to}
              min={value.from}
              max={todayStr()}
              onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
