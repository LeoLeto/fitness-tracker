import { useTheme } from '../../hooks/useTheme';

/**
 * Concrete chart colors per theme (SVG attributes can't resolve CSS vars).
 *
 * Series colors were validated with the palette validator (lightness band,
 * chroma floor, CVD separation ΔE ≥ 8, normal-vision ΔE ≥ 15, contrast ≥ 3:1):
 *   light — teal #0B93AA + amber #B45309 on #FFFFFF
 *   dark  — teal #0B93AA + amber #D97706 on #012142
 * Weight is always teal, calories always amber; colors follow the entity and
 * never change with filtering. Dash patterns and direct legend labels provide
 * secondary (non-color) encoding.
 */
export interface ChartColors {
  weight: string;
  weightMa14: string;
  rawDot: string;
  calories: string;
  caloriesBar: string;
  targetLine: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  text: string;
  textMuted: string;
}

const LIGHT: ChartColors = {
  weight: '#0b93aa',
  weightMa14: 'rgba(11, 147, 170, 0.55)',
  rawDot: '#4e7ea5',
  calories: '#b45309',
  caloriesBar: 'rgba(180, 83, 9, 0.75)',
  targetLine: '#34547a',
  grid: 'rgba(1, 25, 50, 0.08)',
  axis: '#4e7ea5',
  tooltipBg: '#ffffff',
  tooltipBorder: 'rgba(1, 25, 50, 0.14)',
  text: '#011932',
  textMuted: '#34547a',
};

const DARK: ChartColors = {
  weight: '#0b93aa',
  weightMa14: 'rgba(15, 206, 211, 0.55)',
  rawDot: '#72a3c4',
  calories: '#d97706',
  caloriesBar: 'rgba(217, 119, 6, 0.8)',
  targetLine: '#72a3c4',
  grid: 'rgba(114, 163, 196, 0.14)',
  axis: '#72a3c4',
  tooltipBg: '#01264c',
  tooltipBorder: 'rgba(114, 163, 196, 0.25)',
  text: '#f0f3fc',
  textMuted: '#a7c4dd',
};

export function useChartColors(): ChartColors {
  const { resolved } = useTheme();
  return resolved === 'dark' ? DARK : LIGHT;
}

/**
 * Routine colors for training charts (validated 5-slot categorical palettes:
 * light on #FFFFFF, dark on #012142 — all six checks pass). Colors follow the
 * routine entity everywhere; custom routines share a labeled neutral.
 */
const ROUTINE_LIGHT: Record<string, string> = {
  push: '#0b93aa',
  pull: '#7c56c9',
  legs: '#b45309',
  abs: '#c63d92',
  cardio: '#557f2e',
};

const ROUTINE_DARK: Record<string, string> = {
  push: '#0b93aa',
  pull: '#8f80ea',
  legs: '#d97706',
  abs: '#d9679e',
  cardio: '#6fa34c',
};

const ROUTINE_FALLBACK = { light: '#4e7ea5', dark: '#72a3c4' };

export function useRoutineColors(): (routine: string) => string {
  const { resolved } = useTheme();
  const map = resolved === 'dark' ? ROUTINE_DARK : ROUTINE_LIGHT;
  const fallback = resolved === 'dark' ? ROUTINE_FALLBACK.dark : ROUTINE_FALLBACK.light;
  return (routine: string) => map[routine.toLowerCase()] ?? fallback;
}

/** Show ~6 x-axis labels regardless of range length. */
export function tickInterval(pointCount: number): number {
  return Math.max(0, Math.ceil(pointCount / 6) - 1);
}
