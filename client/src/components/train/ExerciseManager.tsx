import { useState } from 'react';
import { api } from '../../services/api';
import { Exercise } from '../../types';
import styles from './train.module.scss';

interface ExerciseManagerProps {
  routine: string;
  exercises: Exercise[];
  onChanged: () => void;
}

/** Add / edit / reorder / archive the routine's exercise catalog. */
export function ExerciseManager({ routine, exercises, onChanged }: ExerciseManagerProps) {
  const [newName, setNewName] = useState('');
  const [newBodyweight, setNewBodyweight] = useState(false);
  const [busy, setBusy] = useState(false);

  const sorted = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      if (newName.trim() === '') return;
      await api.createExercise({
        name: newName.trim(),
        routine,
        isBodyweight: newBodyweight,
      });
      setNewName('');
      setNewBodyweight(false);
    });

  const move = (ex: Exercise, dir: -1 | 1) =>
    run(async () => {
      const i = sorted.indexOf(ex);
      const other = sorted[i + dir];
      if (!other) return;
      await api.updateExercise(ex.id, { ...ex, orderIndex: other.orderIndex });
      await api.updateExercise(other.id, { ...other, orderIndex: ex.orderIndex });
    });

  return (
    <div className={styles.manager}>
      {sorted.map((ex, i) => (
        <div key={ex.id} className={styles.managerRow}>
          <div className={styles.managerInfo}>
            <input
              type="text"
              defaultValue={ex.name}
              aria-label="Exercise name"
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== ex.name) void run(() => api.updateExercise(ex.id, { ...ex, name }));
              }}
            />
            <input
              type="text"
              defaultValue={ex.setupNotes}
              placeholder="machine setup notes"
              aria-label="Setup notes"
              onBlur={(e) => {
                if (e.target.value !== ex.setupNotes) {
                  void run(() => api.updateExercise(ex.id, { ...ex, setupNotes: e.target.value }));
                }
              }}
            />
          </div>
          <div className={styles.managerActions}>
            <button
              type="button"
              className={styles.smallBtn}
              disabled={busy || i === 0}
              onClick={() => void move(ex, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              disabled={busy || i === sorted.length - 1}
              onClick={() => void move(ex, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              title={ex.isBodyweight ? 'Bodyweight exercise' : 'Weighted exercise'}
              onClick={() =>
                void run(() => api.updateExercise(ex.id, { ...ex, isBodyweight: !ex.isBodyweight }))
              }
            >
              {ex.isBodyweight ? 'BW' : 'kg'}
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              disabled={busy}
              onClick={() =>
                void run(() => api.updateExercise(ex.id, { ...ex, archived: !ex.archived }))
              }
            >
              {ex.archived ? 'restore' : 'archive'}
            </button>
          </div>
        </div>
      ))}

      <div className={styles.managerAdd}>
        <input
          type="text"
          value={newName}
          placeholder="New exercise name"
          aria-label="New exercise name"
          onChange={(e) => setNewName(e.target.value)}
        />
        <label className={styles.bwLabel}>
          <input
            type="checkbox"
            checked={newBodyweight}
            onChange={(e) => setNewBodyweight(e.target.checked)}
          />
          BW
        </label>
        <button type="button" className={styles.smallBtn} disabled={busy} onClick={() => void add()}>
          Add
        </button>
      </div>
    </div>
  );
}
