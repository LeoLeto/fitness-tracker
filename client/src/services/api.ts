import {
  AnalyticsSummary,
  DailyEntry,
  Exercise,
  ExerciseSessionPoint,
  Food,
  FoodWithPortions,
  LastPerformance,
  MealTemplate,
  PersonalBest,
  Profile,
  ResolvedMealTemplate,
  TimelinePayload,
  WeeklySummary,
  Workout,
} from '../types';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: string[] | undefined;
    try {
      const body = (await res.json()) as { error?: string; details?: string[] };
      if (body.error) message = body.error;
      details = body.details;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function rangeQuery(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  getProfile: () => request<Profile>('/profile'),
  updateProfile: (patch: Partial<Profile>) =>
    request<Profile>('/profile', { method: 'PUT', body: JSON.stringify(patch) }),

  listEntries: (from?: string, to?: string) =>
    request<DailyEntry[]>(`/entries${rangeQuery(from, to)}`),
  getEntry: async (date: string): Promise<DailyEntry | null> => {
    try {
      return await request<DailyEntry>(`/entries/${date}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  saveEntry: (entry: DailyEntry) =>
    request<DailyEntry>('/entries', { method: 'POST', body: JSON.stringify(entry) }),
  /**
   * Saves only the given fields of a day, leaving the rest untouched — so the
   * Weigh and Food pages never overwrite each other's data.
   */
  patchEntry: (date: string, patch: Partial<Omit<DailyEntry, 'date'>>) =>
    request<DailyEntry>(`/entries/${date}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteEntry: (date: string) =>
    request<void>(`/entries/${date}`, { method: 'DELETE' }),

  getAnalytics: (from?: string, to?: string) =>
    request<AnalyticsSummary>(`/analytics${rangeQuery(from, to)}`),
  getWeekly: () => request<WeeklySummary[]>('/analytics/weekly'),
  getTimeline: (from?: string, to?: string) =>
    request<TimelinePayload>(`/analytics/timeline${rangeQuery(from, to)}`),
  getStrengthSeries: (exercise: string) =>
    request<{ exercise: string; points: ExerciseSessionPoint[] }>(
      `/analytics/strength?exercise=${encodeURIComponent(exercise)}`
    ),
  /** All-time best set per exercise, across every routine. */
  getPersonalBests: async (): Promise<PersonalBest[]> =>
    (await request<{ records: PersonalBest[] }>('/analytics/records')).records,

  /** Foods come back with their one-tap portions already scaled server-side. */
  listFoods: (includeArchived = false) =>
    request<FoodWithPortions[]>(`/foods${includeArchived ? '?includeArchived=1' : ''}`),
  createFood: (data: Partial<Food>) =>
    request<FoodWithPortions>('/foods', { method: 'POST', body: JSON.stringify(data) }),
  updateFood: (id: string, data: Partial<Food>) =>
    request<FoodWithPortions>(`/foods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFood: (id: string) => request<void>(`/foods/${id}`, { method: 'DELETE' }),

  listMealTemplates: (includeArchived = false) =>
    request<ResolvedMealTemplate[]>(
      `/foods/templates${includeArchived ? '?includeArchived=1' : ''}`
    ),
  createMealTemplate: (data: Partial<MealTemplate>) =>
    request<ResolvedMealTemplate>('/foods/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMealTemplate: (id: string, data: Partial<MealTemplate>) =>
    request<ResolvedMealTemplate>(`/foods/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMealTemplate: (id: string) =>
    request<void>(`/foods/templates/${id}`, { method: 'DELETE' }),

  listExercises: (routine?: string) =>
    request<Exercise[]>(`/exercises${routine ? `?routine=${encodeURIComponent(routine)}` : ''}`),
  createExercise: (data: Partial<Exercise>) =>
    request<Exercise>('/exercises', { method: 'POST', body: JSON.stringify(data) }),
  updateExercise: (id: string, data: Partial<Exercise>) =>
    request<Exercise>(`/exercises/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExercise: (id: string) => request<void>(`/exercises/${id}`, { method: 'DELETE' }),

  listWorkouts: (opts: { from?: string; to?: string; routine?: string; type?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.routine) params.set('routine', opts.routine);
    if (opts.type) params.set('type', opts.type);
    const qs = params.toString();
    return request<Workout[]>(`/workouts${qs ? `?${qs}` : ''}`);
  },
  /**
   * Last performance of every exercise before `before`, whichever session it
   * happened in — the previous session alone misses anything skipped that day.
   */
  getLastByExercise: async (before?: string): Promise<LastPerformance[]> => {
    const qs = before ? `?before=${encodeURIComponent(before)}` : '';
    return (await request<{ records: LastPerformance[] }>(`/workouts/last-by-exercise${qs}`))
      .records;
  },
  getLastWorkout: async (routine: string, before?: string): Promise<Workout | null> => {
    try {
      const params = new URLSearchParams({ routine });
      if (before) params.set('before', before);
      return await request<Workout>(`/workouts/last?${params.toString()}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  saveWorkout: (workout: Omit<Workout, 'id'> & { id?: string }) =>
    workout.id
      ? request<Workout>(`/workouts/${workout.id}`, {
          method: 'PUT',
          body: JSON.stringify(workout),
        })
      : request<Workout>('/workouts', { method: 'POST', body: JSON.stringify(workout) }),
  deleteWorkout: (id: string) => request<void>(`/workouts/${id}`, { method: 'DELETE' }),

  /** Markdown / prompt exports as plain text (for clipboard copy). */
  getExportText: async (opts: {
    from?: string;
    to?: string;
    prompt?: boolean;
    includeWorkouts?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.prompt) params.set('prompt', '1');
    if (opts.includeWorkouts === false) params.set('workouts', '0');
    const res = await fetch(`${BASE}/export/chatgpt?${params.toString()}`);
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    return res.text();
  },

  /** Download URLs for CSV / JSON exports. */
  exportUrl: (
    kind: 'csv' | 'json' | 'meals.csv' | 'workouts.csv' | 'workouts.json',
    from?: string,
    to?: string
  ) => `${BASE}/export/${kind}${rangeQuery(from, to)}`,
};
