import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NumericInput } from '../components/fields';
import { SegmentedControl } from '../components/SegmentedControl';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { Food, FoodCategory, FoodUnit, FoodWithPortions, ResolvedMealTemplate } from '../types';
import { parseDecimal } from '../utils/numeric';
import pageStyles from '../styles/page.module.scss';
import styles from './FoodLibraryPage.module.scss';

/** Editable form state for one food (numbers as strings while typing). */
interface FoodForm {
  name: string;
  unit: FoodUnit;
  category: FoodCategory;
  unitLabel: string;
  basisQty: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  portions: string;
  notes: string;
}

const EMPTY_FOOD: FoodForm = {
  name: '',
  unit: 'g',
  category: 'other',
  unitLabel: '',
  basisQty: '100',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  portions: '',
  notes: '',
};

function formFromFood(food: Food): FoodForm {
  const s = (v: number | null) => (v != null ? String(v) : '');
  return {
    name: food.name,
    unit: food.unit,
    category: food.category,
    unitLabel: food.unitLabel,
    basisQty: String(food.basisQty),
    calories: String(food.calories),
    protein: s(food.proteinG),
    carbs: s(food.carbsG),
    fat: s(food.fatG),
    fiber: s(food.fiberG),
    portions: food.portions.join(', '),
    notes: food.notes,
  };
}

function foodFromForm(form: FoodForm): Partial<Food> | string {
  const basisQty = parseDecimal(form.basisQty);
  const calories = parseDecimal(form.calories);
  if (form.name.trim() === '') return 'Give the food a name.';
  if (basisQty == null || basisQty <= 0) return 'The "per" amount must be greater than 0.';
  if (calories == null) return 'Calories are required.';

  const macros = {
    proteinG: parseDecimal(form.protein),
    carbsG: parseDecimal(form.carbs),
    fatG: parseDecimal(form.fat),
    fiberG: parseDecimal(form.fiber),
  };
  if (Object.values(macros).includes(undefined)) return 'One of the macros is not a number.';

  const portions: number[] = [];
  for (const raw of form.portions.split(',')) {
    if (raw.trim() === '') continue;
    const qty = parseDecimal(raw);
    if (qty == null || qty <= 0) return 'Portions must be numbers greater than 0.';
    portions.push(qty);
  }

  return {
    name: form.name.trim(),
    unit: form.unit,
    category: form.category,
    // Only meaningful for countable foods; g and ml name themselves.
    unitLabel: form.unit === 'unit' ? form.unitLabel.trim() : '',
    basisQty,
    calories: Math.round(calories),
    ...(macros as Record<string, number | null>),
    portions,
    notes: form.notes.trim(),
  };
}

export function FoodLibraryPage() {
  const foods = useApi(() => api.listFoods(true), []);
  const templates = useApi(() => api.listMealTemplates(true), []);
  const { toast, show } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [editingFood, setEditingFood] = useState<string | null>(null);
  const [foodForm, setFoodForm] = useState<FoodForm>(EMPTY_FOOD);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      foods.reload();
      templates.reload();
      show(message);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setEditingFood('new');
    setFoodForm(EMPTY_FOOD);
    setError(null);
  };

  const saveFood = async () => {
    const payload = foodFromForm(foodForm);
    if (typeof payload === 'string') {
      setError(payload);
      return;
    }
    const ok = await run(
      () =>
        editingFood === 'new'
          ? api.createFood(payload)
          : api.updateFood(editingFood as string, payload),
      editingFood === 'new' ? 'Food added' : 'Food updated'
    );
    if (ok) setEditingFood(null);
  };

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <Link to="/food" className={styles.back}>
          ‹ Back to Food
        </Link>
        <h1>Food library</h1>
        <p className="muted">
          Nutrition is stored per a reference amount and scaled to any portion, so editing a
          food updates every meal template that uses it.
        </p>
      </div>

      {error && <div className={pageStyles.error}>{error}</div>}

      <h2 className={pageStyles.sectionTitle}>Meal templates</h2>
      {(templates.data ?? []).map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          foods={foods.data ?? []}
          busy={busy}
          onSave={(items, name, time) =>
            void run(
              () => api.updateMealTemplate(template.id, { name, time, items }),
              'Template updated'
            )
          }
          onDelete={() =>
            void run(() => api.deleteMealTemplate(template.id), 'Template deleted')
          }
        />
      ))}
      <NewTemplate
        foods={foods.data ?? []}
        busy={busy}
        onCreate={(name, time, items) =>
          void run(() => api.createMealTemplate({ name, time, items }), 'Template added')
        }
      />

      <h2 className={pageStyles.sectionTitle}>Foods</h2>
      {(foods.data ?? []).map((food) =>
        editingFood === food.id ? (
          <FoodEditor
            key={food.id}
            form={foodForm}
            setForm={setFoodForm}
            busy={busy}
            onSave={() => void saveFood()}
            onCancel={() => setEditingFood(null)}
          />
        ) : (
          <FoodRow
            key={food.id}
            food={food}
            busy={busy}
            onEdit={() => {
              setEditingFood(food.id);
              setFoodForm(formFromFood(food));
              setError(null);
            }}
            onDelete={() => void run(() => api.deleteFood(food.id), 'Food deleted')}
          />
        )
      )}

      {editingFood === 'new' ? (
        <FoodEditor
          form={foodForm}
          setForm={setFoodForm}
          busy={busy}
          onSave={() => void saveFood()}
          onCancel={() => setEditingFood(null)}
        />
      ) : (
        <button type="button" className="btn" onClick={startNew}>
          + Add food
        </button>
      )}

      {toast}
    </div>
  );
}

function FoodRow({
  food,
  busy,
  onEdit,
  onDelete,
}: {
  food: FoodWithPortions;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const per = food.unit === 'unit' ? `per ${food.basisQty}` : `per ${food.basisQty} ${food.unit}`;
  const macros = [
    food.proteinG != null ? `${food.proteinG} P` : null,
    food.carbsG != null ? `${food.carbsG} C` : null,
    food.fatG != null ? `${food.fatG} F` : null,
    food.fiberG != null ? `${food.fiberG} fib` : null,
  ].filter(Boolean);

  return (
    <div className={`card ${styles.foodRow}`}>
      <div className={styles.foodInfo}>
        <span className={styles.foodName}>{food.name}</span>
        <span className={styles.foodDetail}>
          {food.calories} kcal {per}
          {macros.length > 0 ? ` · ${macros.join(' · ')}` : ''}
        </span>
        {food.portionOptions.length > 0 && (
          <span className={styles.foodPortions}>
            portions: {food.portionOptions.map((p) => `${p.label} (${p.calories} kcal)`).join(', ')}
          </span>
        )}
        {/* The note says what the quantity actually refers to (dry weight, one
            teaspoon…) — it belongs next to the food, not only in the editor. */}
        {food.notes !== '' && <span className={styles.foodNote}>{food.notes}</span>}
      </div>
      <div className={styles.rowActions}>
        <button type="button" className={styles.smallBtn} disabled={busy} onClick={onEdit}>
          Edit
        </button>
        <button type="button" className={styles.smallBtn} disabled={busy} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function FoodEditor({
  form,
  setForm,
  busy,
  onSave,
  onCancel,
}: {
  form: FoodForm;
  setForm: (f: FoodForm) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof FoodForm>(key: K, value: FoodForm[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <div className={`card ${styles.editor}`}>
      <label className={styles.field}>
        <span>Name</span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Skimmed milk"
        />
      </label>

      <div className={styles.basisRow}>
        <div className={styles.field}>
          <span>Measured in</span>
          <SegmentedControl<FoodUnit>
            ariaLabel="Unit"
            options={[
              { value: 'g', label: 'g' },
              { value: 'ml', label: 'ml' },
              { value: 'unit', label: 'units' },
            ]}
            value={form.unit}
            onChange={(v) => set('unit', v)}
          />
        </div>
        <label className={styles.field}>
          <span>Values below are per</span>
          <NumericInput
            value={form.basisQty}
            onChange={(v) => set('basisQty', v)}
            ariaLabel="Reference amount"
          />
        </label>
      </div>

      {/* Anything but "Staple" appears in quick add's weigh-it-and-log-it tab,
          grouped under its category; staples are logged from their portions. */}
      <div className={styles.field}>
        <span>Category</span>
        <SegmentedControl<FoodCategory>
          ariaLabel="Category"
          options={[
            { value: 'other', label: 'Staple' },
            { value: 'fruit', label: 'Fruit' },
            { value: 'vegetable', label: 'Vegetable' },
            { value: 'dairy', label: 'Dairy' },
            { value: 'pantry', label: 'Pantry' },
            { value: 'dressing', label: 'Dressing' },
          ]}
          value={form.category}
          onChange={(v) => set('category', v)}
        />
      </div>

      {form.unit === 'unit' && (
        <label className={styles.field}>
          <span>One unit is called (optional)</span>
          <input
            type="text"
            value={form.unitLabel}
            onChange={(e) => set('unitLabel', e.target.value)}
            placeholder="e.g. tsp, slice, scoop"
          />
        </label>
      )}

      <div className={styles.nutritionRow}>
        <label className={styles.field}>
          <span>kcal</span>
          <NumericInput
            decimal={false}
            value={form.calories}
            onChange={(v) => set('calories', v)}
            ariaLabel="Calories"
          />
        </label>
        <label className={styles.field}>
          <span>protein</span>
          <NumericInput value={form.protein} onChange={(v) => set('protein', v)} ariaLabel="Protein" />
        </label>
        <label className={styles.field}>
          <span>carbs</span>
          <NumericInput value={form.carbs} onChange={(v) => set('carbs', v)} ariaLabel="Carbs" />
        </label>
        <label className={styles.field}>
          <span>fat</span>
          <NumericInput value={form.fat} onChange={(v) => set('fat', v)} ariaLabel="Fat" />
        </label>
        <label className={styles.field}>
          <span>fiber</span>
          <NumericInput value={form.fiber} onChange={(v) => set('fiber', v)} ariaLabel="Fiber" />
        </label>
      </div>
      <p className={styles.hint}>Leave a macro blank when you don't track it — blank stays blank rather than counting as zero.</p>

      <label className={styles.field}>
        <span>One-tap portions (comma separated)</span>
        <input
          type="text"
          inputMode="decimal"
          value={form.portions}
          onChange={(e) => set('portions', e.target.value)}
          placeholder="e.g. 200, 300"
        />
      </label>

      <label className={styles.field}>
        <span>Notes</span>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="optional"
        />
      </label>

      <div className={styles.editorActions}>
        <button type="button" className="btn btn--accent" disabled={busy} onClick={onSave}>
          Save food
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

interface DraftItem {
  foodId: string;
  foodName: string;
  qty: string;
}

function TemplateCard({
  template,
  foods,
  busy,
  onSave,
  onDelete,
}: {
  template: ResolvedMealTemplate;
  foods: FoodWithPortions[];
  busy: boolean;
  onSave: (
    items: { foodId: string; foodName: string; qty: number }[],
    name: string,
    time: string | null
  ) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template.name);
  const [time, setTime] = useState(template.time ?? '');
  const [items, setItems] = useState<DraftItem[]>(
    template.items.map((i) => ({ foodId: i.foodId, foodName: i.foodName, qty: String(i.qty) }))
  );
  const [newFoodId, setNewFoodId] = useState('');

  const save = () => {
    const resolved: { foodId: string; foodName: string; qty: number }[] = [];
    for (const item of items) {
      const qty = parseDecimal(item.qty);
      if (qty == null || qty <= 0) return;
      resolved.push({ foodId: item.foodId, foodName: item.foodName, qty });
    }
    onSave(resolved, name.trim(), time.trim() === '' ? null : time);
    setOpen(false);
  };

  /** Blank for foods counted in units — those are written as a bare "4". */
  const unitOf = (foodId: string) => {
    const unit = foods.find((f) => f.id === foodId)?.unit;
    return unit != null && unit !== 'unit' ? unit : '';
  };

  const addItem = () => {
    const food = foods.find((f) => f.id === newFoodId);
    if (!food) return;
    setItems([
      ...items,
      { foodId: food.id, foodName: food.name, qty: String(food.portions[0] ?? food.basisQty) },
    ]);
    setNewFoodId('');
  };

  return (
    <div className={`card ${styles.template}`}>
      <button
        type="button"
        className={styles.templateHeader}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.templateTitle}>
          {template.time && <span className={styles.templateTime}>{template.time}</span>}
          <span className={styles.foodName}>{template.name}</span>
        </span>
        <span className={styles.templateTotals}>
          {template.calories} kcal
          {template.proteinG != null ? ` · ${template.proteinG} P` : ''}
          {template.fiberG != null ? ` · ${template.fiberG} fib` : ''}
        </span>
      </button>

      {/* Quantities with their units, so the collapsed card is a usable recipe. */}
      {!open && (
        <p className={styles.templateItems}>
          {template.parts
            .map((p) => `${p.qty} ${p.foodName}${p.notes !== '' ? ` (${p.notes})` : ''}`)
            .join(' + ') || 'No items'}
        </p>
      )}

      {open && (
        <>
          <div className={styles.basisRow}>
            <label className={styles.field}>
              <span>Name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>

          {items.map((item, i) => (
            <div key={`${item.foodId}-${i}`} className={styles.itemRow}>
              <span className={styles.itemName}>{item.foodName}</span>
              <NumericInput
                value={item.qty}
                onChange={(v) =>
                  setItems(items.map((it, j) => (j === i ? { ...it, qty: v } : it)))
                }
                ariaLabel={`${item.foodName} quantity`}
                className={styles.itemQty}
              />
              {/* The unit the number is in — grams and millilitres are not
                  interchangeable, and the item itself doesn't carry the unit. */}
              <span className={styles.itemUnit}>{unitOf(item.foodId)}</span>
              <button
                type="button"
                className={styles.smallBtn}
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}

          <div className={styles.itemRow}>
            <select
              value={newFoodId}
              aria-label="Add a food to this template"
              onChange={(e) => setNewFoodId(e.target.value)}
            >
              <option value="">Add a food…</option>
              {foods.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.smallBtn}
              disabled={newFoodId === ''}
              onClick={addItem}
            >
              Add
            </button>
          </div>

          <div className={styles.editorActions}>
            <button type="button" className="btn btn--accent" disabled={busy} onClick={save}>
              Save template
            </button>
            <button type="button" className="btn btn--danger" disabled={busy} onClick={onDelete}>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function NewTemplate({
  foods,
  busy,
  onCreate,
}: {
  foods: FoodWithPortions[];
  busy: boolean;
  onCreate: (
    name: string,
    time: string | null,
    items: { foodId: string; foodName: string; qty: number }[]
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');

  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        + Add meal template
      </button>
    );
  }

  return (
    <div className={`card ${styles.template}`}>
      <div className={styles.basisRow}>
        <label className={styles.field}>
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Egg Breakfast"
          />
        </label>
        <label className={styles.field}>
          <span>Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <p className={styles.hint}>
        Create it first, then open it to add foods{foods.length === 0 ? ' (add some foods below first)' : ''}.
      </p>
      <div className={styles.editorActions}>
        <button
          type="button"
          className="btn btn--accent"
          disabled={busy || name.trim() === ''}
          onClick={() => {
            onCreate(name.trim(), time.trim() === '' ? null : time, []);
            setName('');
            setTime('');
            setOpen(false);
          }}
        >
          Create template
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
