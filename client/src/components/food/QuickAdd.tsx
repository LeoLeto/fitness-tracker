import { useState } from 'react';
import { NumericInput } from '../fields';
import { FoodPortion, FoodWithPortions, Meal, ResolvedMealTemplate } from '../../types';
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

/** Scales a food to an arbitrary quantity — mirrors the server's portion maths. */
function scaleFood(food: FoodWithPortions, qty: number): FoodPortion {
  const factor = food.basisQty === 0 ? 0 : qty / food.basisQty;
  const macro = (v: number | null) => (v == null ? null : Math.round(v * factor * 10) / 10);
  return {
    qty,
    label: food.unit === 'unit' ? String(qty) : `${qty} ${food.unit}`,
    calories: Math.round(food.calories * factor),
    proteinG: macro(food.proteinG),
    carbsG: macro(food.carbsG),
    fatG: macro(food.fatG),
    fiberG: macro(food.fiberG),
  };
}

/**
 * One-tap logging from the food library: a whole meal template, the entire
 * day's plan, or a single food at one of its usual portions.
 */
export function QuickAdd({ foods, templates, onAdd, busy = false }: QuickAddProps) {
  const [tab, setTab] = useState<'meals' | 'foods' | 'weigh'>('meals');
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customQty, setCustomQty] = useState('');

  const dayTotal = templates.reduce((acc, t) => acc + t.calories, 0);

  // Produce is logged by whatever the scale says — a wedge cut off a pumpkin
  // has no portion worth a button — so it gets its own tab keyed on weight
  // rather than sharing the one-tap list.
  const produce = {
    fruit: foods.filter((f) => f.category === 'fruit'),
    vegetable: foods.filter((f) => f.category === 'vegetable'),
  };
  const hasProduce = produce.fruit.length + produce.vegetable.length > 0;

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
          {foods.length === 0 && (
            <p className={styles.empty}>No foods yet — add them in the food library.</p>
          )}
          {foods.map((food) => (
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
                    {food.unit === 'unit' ? 'units' : food.unit}
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
          {!hasProduce && (
            <p className={styles.empty}>
              No fruit or vegetables in the library yet — add one and set its category to
              Fruit or Vegetable.
            </p>
          )}
          {(['fruit', 'vegetable'] as const).map((category) =>
            produce[category].length === 0 ? null : (
              <div key={category} className={styles.weighGroup}>
                <h3 className={styles.weighHeading}>
                  {category === 'fruit' ? 'Fruits' : 'Vegetables'}
                </h3>
                {produce[category].map((food) => (
                  <WeighRow key={food.id} food={food} busy={busy} onAdd={onAdd} />
                ))}
              </div>
            )
          )}
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
      <span className={styles.weighUnit}>{food.unit === 'unit' ? '×' : food.unit}</span>
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
