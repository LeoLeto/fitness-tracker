/**
 * Numeric text-entry helpers.
 *
 * The app deliberately avoids `<input type="number">`: it only accepts a
 * period as the decimal separator, while phone keypads show whatever the
 * device locale uses (a comma in es-CL, for example). The browser silently
 * discards the rejected character, which makes decimals impossible to type.
 * Instead we use text inputs with `inputMode`, sanitise the keystrokes here,
 * and accept either separator when parsing.
 */

/**
 * Strips anything that can't belong in a number.
 * `decimal: false` (integers) also removes separators entirely, so "2,015"
 * becomes 2015; otherwise only the first separator is kept.
 */
export function sanitizeNumeric(raw: string, decimal: boolean): string {
  const digitsAndSeparators = raw.replace(/[^\d.,]/g, '');
  if (!decimal) return digitsAndSeparators.replace(/[.,]/g, '');

  const first = digitsAndSeparators.search(/[.,]/);
  if (first === -1) return digitsAndSeparators;
  return (
    digitsAndSeparators.slice(0, first + 1) +
    digitsAndSeparators.slice(first + 1).replace(/[.,]/g, '')
  );
}

/**
 * Parses user input into a number.
 * `null` means the field was left empty (not recorded);
 * `undefined` means the text isn't a usable number.
 */
export function parseDecimal(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
