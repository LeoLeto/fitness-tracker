import { WorkoutSet } from './types';

/**
 * Parser for the user's set notation, e.g.:
 *
 *   "100 x8; 90 x7 (2 RIR) x6? x5*🚨"
 *   "SO ⬆️ 30 x10 (2 RIR) x9 (1 RIR) x8 (0 RIR)"
 *   "(w/step) 65 x9 (2 RIR) x8 (0 RIR); 60 x8 (2 RIR)"
 *   "DS35x3/30x3; 30 x5; 25 x6"
 *   "x8 x5 x5"                      (bodyweight)
 *
 * Grammar (informal):
 *   line   := [orderSwap] [leading text] group ((";" | "," | ":") group)*
 *   group  := [leading text] [weight | "BW"] setTok+
 *   setTok := "x" INT ["?"] ["*"] [🚨|💀] [letter] ["(" (INT["+"]|"?")? "RIR" ")"]
 *             | "(" free text ")"          → note on the previous set
 *   orderSwap := ("SO"|"OS")? (⬆️|⬇️)      → exercise order swapped that day
 *
 * Flags: `?` = rep count uncertain, `*` = last rep with bad form,
 * `🚨` = set cut short because of pain (💀 is kept as a note).
 * Weight persists across set tokens until a new number appears.
 */

export interface ParsedSession {
  sets: WorkoutSet[];
  orderMoved: 'up' | 'down' | null;
  variation: string | null;
  warnings: string[];
}

function emptySet(): Omit<WorkoutSet, 'weightKg' | 'reps'> {
  return {
    rir: null,
    repsUncertain: false,
    badForm: false,
    pain: false,
    isDropSet: false,
    note: null,
  };
}

function appendNote(set: WorkoutSet, note: string): void {
  set.note = set.note ? `${set.note}; ${note}` : note;
}

const UP_ARROWS = /⬆️?|↑/u;
const DOWN_ARROWS = /⬇️?|↓/u;

const RIR_RE = /^\(\s*(\d+\s*\+?|\?)?\s*RIR\s*\)$/i;

// One token at a time; leftovers accumulate as free text.
const TOKEN_RE =
  /DS\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+)\s*\/\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+)|x\s*(\d+)\s*([?*]{0,2})\s*(🚨|💀)?\s*([A-Za-z](?=\s|$))?|\(([^)]*)\)|(?:^|(?<=\s))(BW)(?=\s|$)|(\d+(?:[.,]\d+)?)|(x\s*\?)|(\S+)/gu;

/**
 * Parses one session's sets for one exercise. `isBodyweight` makes weightless
 * set tokens legal (pull-ups etc.); otherwise they produce a warning.
 */
export function parseSessionLine(
  raw: string,
  opts: { isBodyweight?: boolean } = {}
): ParsedSession {
  const warnings: string[] = [];
  // Un-escape the markdown that word processors add ("x7\*" → "x7*").
  let text = raw.replace(/\\([*_])/g, '$1').trim();

  // Order-swap marker: "SO ⬆️", "OS ⬇️", or a bare arrow.
  let orderMoved: 'up' | 'down' | null = null;
  const swapMatch = text.match(
    /^\s*(?:SO|OS)?\s*(⬆️|⬆|↑|⬇️|⬇|↓)\s*/u
  );
  if (swapMatch) {
    orderMoved = UP_ARROWS.test(swapMatch[1]) ? 'up' : DOWN_ARROWS.test(swapMatch[1]) ? 'down' : null;
    text = text.slice(swapMatch[0].length);
  }

  const sets: WorkoutSet[] = [];
  const variationParts: string[] = [];

  // Split into weight groups. ";" is the usual separator; "," and a stray ":"
  // appear as typos for it in the historical notes.
  const groups = text.split(/[;,:]/);

  for (const groupRaw of groups) {
    const group = groupRaw.trim();
    if (group === '') continue;

    let currentWeight: number | null = null;
    let weightSeen = false;
    let groupText: string[] = [];
    let groupHadSets = false;

    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(group)) !== null) {
      if (m[1] !== undefined) {
        // Drop set: DS<w1>x<r1>/<w2>x<r2>
        const pairs: Array<[string, string]> = [
          [m[1], m[2]],
          [m[3], m[4]],
        ];
        for (const [w, r] of pairs) {
          sets.push({
            ...emptySet(),
            weightKg: Number(w.replace(',', '.')),
            reps: Number(r),
            isDropSet: true,
          });
        }
        groupHadSets = true;
      } else if (m[5] !== undefined) {
        // Set token: x<reps> with optional flags
        const flags = m[6] ?? '';
        const set: WorkoutSet = {
          ...emptySet(),
          weightKg: currentWeight,
          reps: Number(m[5]),
          repsUncertain: flags.includes('?'),
          badForm: flags.includes('*'),
          pain: m[7] === '🚨',
        };
        if (m[7] === '💀') appendNote(set, '💀');
        if (m[8]) appendNote(set, m[8]); // stray suffix letter, e.g. "x6R"
        if (!weightSeen && !opts.isBodyweight && currentWeight === null && sets.every((s) => s.weightKg === null)) {
          // weightless set on a weighted exercise — keep it but flag it
          if (!warnings.includes('set without a weight')) warnings.push('set without a weight');
        }
        sets.push(set);
        groupHadSets = true;
      } else if (m[9] !== undefined) {
        // Parenthesised token: RIR or a free-text note
        const paren = `(${m[9]})`;
        const rir = paren.match(RIR_RE);
        if (rir) {
          const last = sets[sets.length - 1];
          if (!last) {
            warnings.push(`RIR without a set: "${paren}"`);
          } else {
            const v = rir[1]?.trim();
            last.rir = v && v !== '?' ? Number.parseInt(v, 10) : null;
            if (v && v.includes('+')) appendNote(last, `${v} RIR`);
          }
        } else if (groupHadSets && sets.length > 0) {
          appendNote(sets[sets.length - 1], m[9].trim());
        } else {
          groupText.push(m[9].trim());
        }
      } else if (m[10] !== undefined) {
        // Explicit bodyweight marker
        currentWeight = null;
        weightSeen = true;
      } else if (m[11] !== undefined) {
        currentWeight = Number(m[11].replace(',', '.'));
        weightSeen = true;
      } else if (m[12] !== undefined) {
        warnings.push('set with unknown rep count ("x?") skipped');
      } else if (m[13] !== undefined) {
        // Free text: before any set → variation; after a set → note on it.
        if (groupHadSets && sets.length > 0) appendNote(sets[sets.length - 1], m[13]);
        else groupText.push(m[13]);
      }
    }

    // Leading free text that never met a set in this group → variation.
    if (groupText.length > 0) {
      const note = groupText.join(' ').trim();
      if (note !== '') variationParts.push(note);
    }
  }

  return {
    sets,
    orderMoved,
    variation: variationParts.length > 0 ? variationParts.join(' / ') : null,
    warnings,
  };
}

// ── Formatting (the reverse direction) ─────────────────────────────────────────

function formatFlags(s: WorkoutSet): string {
  let out = '';
  if (s.repsUncertain) out += '?';
  if (s.badForm) out += '*';
  if (s.pain) out += '🚨';
  return out;
}

/**
 * Compact one-line rendering in the user's own notation, e.g.
 * "90 x7 (2 RIR) x7 (1 RIR) x8* (0 RIR); 80 x6".
 * Used in exports and history summaries.
 */
export function formatSets(sets: WorkoutSet[]): string {
  const parts: string[] = [];
  let currentWeight: number | null | undefined = undefined;
  let current = '';

  for (const s of sets) {
    if (s.weightKg !== currentWeight || current === '') {
      if (current !== '') parts.push(current);
      currentWeight = s.weightKg;
      current = s.weightKg != null ? String(s.weightKg) : 'BW';
    }
    current += ` x${s.reps}${formatFlags(s)}`;
    if (s.rir != null) current += ` (${s.rir} RIR)`;
  }
  if (current !== '') parts.push(current);
  return parts.join('; ');
}
