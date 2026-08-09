import { ReactNode } from 'react';
import { SegmentedControl } from './SegmentedControl';
import styles from './fields.module.scss';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  /** 'decimal' for weight-style inputs, 'numeric' for integers. */
  mode?: 'decimal' | 'numeric';
  step?: string;
  big?: boolean;
}

/** Large mobile-friendly numeric input. State is kept as a string so partial input ("63.") works. */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  placeholder,
  mode = 'decimal',
  step,
  big = false,
}: NumberFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap}>
        <input
          type="number"
          inputMode={mode}
          step={step ?? (mode === 'decimal' ? '0.1' : '1')}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={big ? `${styles.input} ${styles.big}` : styles.input}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
    </label>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'time';
}

export function TextField({ label, value, onChange, placeholder, type = 'text' }: TextFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
      />
    </label>
  );
}

export type TriState = 'unset' | 'yes' | 'no';

interface TriStateFieldProps {
  label: string;
  value: TriState;
  onChange: (value: TriState) => void;
  hint?: string;
}

/** Optional Yes/No field — "–" means not recorded (never coerced to No). */
export function TriStateField({ label, value, onChange, hint }: TriStateFieldProps) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label}
        {hint && <span className={styles.hint}> {hint}</span>}
      </span>
      <SegmentedControl<TriState>
        ariaLabel={label}
        options={[
          { value: 'unset', label: '–' },
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Yes' },
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export function triStateToBool(v: TriState): boolean | null {
  if (v === 'unset') return null;
  return v === 'yes';
}

export function boolToTriState(v: boolean | null): TriState {
  if (v === null) return 'unset';
  return v ? 'yes' : 'no';
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
