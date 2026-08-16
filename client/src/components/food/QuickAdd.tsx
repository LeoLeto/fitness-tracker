import { useState } from 'react';
import { NumericInput } from '../fields';
import { FoodCategory, FoodPortion, FoodWithPortions, Meal, ResolvedMealTemplate } from '../../types';
import { parseDecimal } from '../../utils/numeric';
import styles from './quickAdd.module.scss';

interface QuickAddProps {
  foods: FoodWithPortions[];
  templates: ResolvedMealTemplate[];
  /** Appends meals to the day being edited, which saves them immediately. */
  onAdd: (meals: Meal[]) => void;
  /**
   * A save is in flight. Each save sends the whole meal list, so a second tap
   * mid-flight could land the older list last and lose the newer meal.
   */
  busy?: boolean;
}

function portionToMeal(food: FoodWithPortions, portion: FoodPortion): Meal {
  return {
    label: `${food.name} ${portion.label}`.trim(),
    time: null,
    calories: portion.calories,
    proteinG: portion.proteinG,
    carbsG: portion.carbsG,
    fatG: portion.fatG,
    fiberG: portion.fiberG,
    notes: null,
  };
}

function templateToMeal(template: ResolvedMealTemplate): Meal {
  return {
    label: template.name,
    time: template.time,
    calories: template.calories,
    proteinG: template.proteinG,
    carbsG: template.carbsG,
    fatG: template.fatG,
    fiberG: template.fiberG,
    notes: null,
  };
}

/** Mirrors the server's `formatQty`: "150 g", "200 ml", "1 tsp", plain "4". */
function formatQty(qty: number, food: FoodWithPortions): string {
  if (food.unit !== 'unit') return `${qty} ${food.unit}`;
  return food.unitLabel === '' ? String(qty) : `${qty} ${food.unitLabel}`;
}

/** Scales a food to an arbitrary quantity — mirrors the server's portion maths. */
function scaleFood(food: FoodWithPortions, qty: number): FoodPortion {
  const factor = food.basisQty === 0 ? 0 : qty / food.basisQty;
  const macro = (v: number | null) => (v == null ? null : Math.round(v * factor * 10) / 10);
  return {
    qty,
    label: formatQty(qty, food),
    calories: Math.round(food.calories * factor),
    proteinG: macro(food.proteinG),
    carbsG: macro(food.carbsG),
    fatG: macro(food.fatG),
    fiberG: macro(food.fiberG),
  };
}

/**
 * The Weigh tab's sections, in display order. Adding a category to
 * `FoodCategory` and a row here is all a new group needs.
 */
const WEIGH_GROUPS: { category: FoodCategory; heading: string }[] = [
  { category: 'fruit', heading: 'Fruits' },
  { category: 'vegetable', heading: 'Vegetables' },
  { category: 'dairy', heading: 'Dairy' },
  { category: 'dressing', heading: 'Dressings & oils' },
];

/**
 * One-tap logging from the food library: a whole meal template, the entire
 * day's plan, or a single food at one of its usual portions.
 */
export function QuickAdd({ foods, templates, onAdd, busy = false }: QuickAddProps) {
  const [tab, setTab] = useState<'meals' | 'foods' | 'weigh'>('meals');
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customQty, setCustomQty] = useState('');
  // Closed to start with, one open at a time: forty-odd weighed foods across
  // four groups is a lot of scrolling to reach the one you actually cut up.
  const [openGroup, setOpenGroup] = useState<FoodCategory | null>(null);

  const dayTotal = templates.reduce((acc, t) => acc + t.calories, 0);

  // Anything logged by whatever the scale says — a wedge cut off a pumpkin or a
  // slab of cheese has no portion worth a button — lives in its own tab keyed on
  // weight rather than sharing the one-tap list. Categories are the grouping
  // inside it; `other` is the staples, which are logged by portion instead.
  const weighed = WEIGH_GROUPS.map((group) => ({
    ...group,
    foods: foods.filter((f) => f.category === group.category),
  })).filter((group) => group.foods.length > 0);

  // The Foods tab is the one-tap list, so it only holds foods that actually
  // have a portion button. Produce has none — it is weighed — and listing it
  // here filled the tab with bare names and pushed the staples off screen.
  // The overlap is deliberate: an apple has a usual 180 g portion *and* can be
  // put on the scale, so it belongs in both tabs.
  const portionFoods = foods.filter((f) => f.portionOptions.length > 0);

  const addCustom = (food: FoodWithPortions) => {
    const qty = parseDecimal(customQty);
    if (qty == null || qty <= 0) return;
    onAdd([portionToMeal(food, scaleFood(food, qty))]);
    setCustomFor(null);
    setCustomQty('');
  };

  return (
    <section className={`card ${styles.panel}`}>
      <div className={styles.tabs} role="group" aria-label="Quick add source">
        <button
          type="button"
          className={tab === 'meals' ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          aria-pressed={tab === 'meals'}
          onClick={() => setTab('meals')}
        >
          Meals
        </button>
        <button
          type="button"
          className={tab === 'foods' ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          aria-pressed={tab === 'foods'}
          onClick={() => setTab('foods')}
        >
          Foods
        </button>
        <button
          type="button"
          className={tab === 'weigh' ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          aria-pressed={tab === 'weigh'}
          onClick={() => setTab('weigh')}
        >
          Weigh
        </button>
      </div>

      {tab === 'meals' && (
        <>
          {templates.length === 0 && (
            <p className={styles.empty}>
              No meal templates yet — build them in the food library.
            </p>
          )}
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={styles.row}
              disabled={busy}
              onClick={() => onAdd([templateToMeal(template)])}
            >
              <span className={styles.rowMain}>
                {template.time && <span className={styles.time}>{template.time}</span>}
                <span className={styles.name}>{template.name}</span>
                {/* The recipe: what to weigh out, so the row doubles as the
                    reference sheet while the meal is being prepared. */}
                {template.parts.length > 0 && (
                  <span className={styles.recipe}>
                    {template.parts.map((part, i) => (
                      <span key={`${part.foodName}-${i}`} className={styles.part}>
                        <span className={styles.partQty}>{part.qty}</span> {part.foodName}
                        {part.notes !== '' && (
                          <span className={styles.partNote}> ({part.notes})</span>
                        )}
                      </span>
                    ))}
                  </span>
                )}
                {template.missingItems.length > 0 && (
                  <span className={styles.warn}>
                    missing: {template.missingItems.join(', ')}
                  </span>
                )}
              </span>
              <span className={styles.macros}>
                <span className={styles.kcal}>{template.calories} kcal</span>
                {template.proteinG != null && <span>{template.proteinG} P</span>}
              </span>
            </button>
          ))}

          {templates.length > 1 && (
            <button
              type="button"
              className={styles.wholeDay}
              disabled={busy}
              onClick={() => onAdd(templates.map(templateToMeal))}
            >
              + Add all {templates.length} meals ({dayTotal.toLocaleString('en-US')} kcal)
            </button>
          )}
        </>
      )}

      {tab === 'foods' && (
        <>
          {portionFoods.length === 0 && (
            <p className={styles.empty}>
              No foods with one-tap portions yet — add portions to a food in the library,
              or use the Weigh tab.
            </p>
          )}
          {portionFoods.map((food) => (
            <div key={food.id} className={styles.foodRow}>
              <button
                type="button"
                className={styles.foodName}
                aria-expanded={customFor === food.id}
                onClick={() => {
                  const opening = customFor !== food.id;
                  setCustomFor(opening ? food.id : null);
                  setCustomQty(opening ? String(food.portions[0] ?? food.basisQty) : '');
                }}
              >
                {food.name}
              </button>
              <div className={styles.portions}>
                {food.portionOptions.map((portion) => (
                  <button
                    key={portion.qty}
                    type="button"
                    className={styles.portion}
                    disabled={busy}
                    onClick={() => onAdd([portionToMeal(food, portion)])}
                  >
                    <span className={styles.portionQty}>{portion.label}</span>
                    <span className={styles.portionKcal}>{portion.calories} kcal</span>
                  </button>
                ))}
              </div>
              {customFor === food.id && (
                <div className={styles.customRow}>
                  <NumericInput
                    value={customQty}
                    onChange={setCustomQty}
                    ariaLabel={`Custom amount of ${food.name}`}
                    className={styles.customInput}
                  />
                  <span className={styles.customUnit}>
                    {food.unit === 'unit' ? food.unitLabel || 'units' : food.unit}
                  </span>
                  <span className={styles.customPreview}>
                    {(() => {
                      const qty = parseDecimal(customQty);
                      return qty != null && qty > 0 ? `${scaleFood(food, qty).calories} kcal` : '—';
                    })()}
                  </span>
                  <button
                    type="button"
                    className={styles.customAdd}
                    disabled={busy}
                    onClick={() => addCustom(food)}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === 'weigh' && (
        <>
          {weighed.length === 0 && (
            <p className={styles.empty}>
              Nothing to weigh in the library yet — add a food and give it a category
              other than Staple.
            </p>
          )}
          {weighed.map((group) => {
            const open = openGroup === group.category;
            return (
              <div key={group.category} className={styles.weighGroup}>
                <button
                  type="button"
                  className={styles.weighHeading}
                  aria-expanded={open}
                  onClick={() => setOpenGroup(open ? null : group.category)}
                >
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span> {group.heading}
                  <span className={styles.weighCount}>{group.foods.length}</span>
                </button>
                {open &&
                  group.foods.map((food) => (
                    <WeighRow key={food.id} food={food} busy={busy} onAdd={onAdd} />
                  ))}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

/**
 * One weighed item: put the piece on the scale, type the grams, log it. The
 * calories update as you type, so an over-large portion is obvious before it
 * becomes an entry rather than after.
 */
function WeighRow({
  food,
  busy,
  onAdd,
}: {
  food: FoodWithPortions;
  busy: boolean;
  onAdd: (meals: Meal[]) => void;
}) {
  const [qty, setQty] = useState('');
  const parsed = parseDecimal(qty);
  const valid = parsed != null && parsed > 0;
  const preview = valid ? scaleFood(food, parsed) : null;

  const add = () => {
    if (!valid || preview === null) return;
    onAdd([portionToMeal(food, preview)]);
    setQty('');
  };

  return (
    <div className={styles.weighRow}>
      <span className={styles.weighName}>
        {food.name}
        <span className={styles.weighBasis}>
          {Math.round((food.calories / food.basisQty) * 100)} kcal/100 {food.unit}
        </span>
      </span>
      <NumericInput
        value={qty}
        onChange={setQty}
        placeholder="0"
        ariaLabel={`Weight of ${food.name} in ${food.unit}`}
        className={styles.weighInput}
      />
      <span className={styles.weighUnit}>
        {food.unit === 'unit' ? food.unitLabel || '×' : food.unit}
      </span>
      <span className={styles.weighPreview}>{preview ? `${preview.calories} kcal` : '—'}</span>
      <button
        type="button"
        className={styles.customAdd}
        disabled={busy || !valid}
        onClick={add}
      >
        Add
      </button>
    </div>
  );
}
