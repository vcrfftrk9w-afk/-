import type { AppState, Habit, HabitLevel } from './types';
import { addDays, isoDate, plural } from '../lib/date';

export interface HabitStats {
  habitId: string;
  /** Сколько раз выполнено за последние 14 дней. */
  doneLast14: number;
  /** Последний день, когда привычка выполнялась. */
  lastDone?: string;
  /** Честная формулировка без «ты потерял серию из 47 дней». */
  phrase: string;
}

/**
 * Прогресс привычки не обнуляется после одного пропуска.
 * Считаем выполнения за две недели и говорим об этом спокойно.
 */
export function habitStats(state: AppState, habit: Habit, today = isoDate()): HabitStats {
  const from = addDays(today, -13);
  const logs = state.habitLogs
    .filter((l) => l.habitId === habit.id && l.date >= from && l.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const doneLast14 = logs.length;
  const lastDone = logs.length ? logs[logs.length - 1].date : undefined;

  let phrase: string;
  if (doneLast14 === 0) {
    phrase = 'Пока не начата. Начнём с минимальной версии — этого достаточно.';
  } else {
    const times = `${doneLast14} ${plural(doneLast14, 'раз', 'раза', 'раз')}`;
    const gap = lastDone && lastDone !== today ? ' Был перерыв — продолжаем.' : '';
    phrase = `За последние две недели привычка выполнена ${times}.${gap}`;
  }
  return { habitId: habit.id, doneLast14, lastDone, phrase };
}

export function habitVersion(habit: Habit, level: HabitLevel): { text: string; minutes: number } {
  if (level === 'min') return { text: habit.minVersion, minutes: habit.minMinutes };
  if (level === 'extended') return { text: habit.extendedVersion, minutes: habit.extendedMinutes };
  return { text: habit.normalVersion, minutes: habit.normalMinutes };
}

/**
 * Минимум нужен, чтобы сохранить точку входа в сложный день.
 * Но приложение не делает вид, что две минуты равны полноценной работе.
 */
export const MIN_VERSION_NOTE =
  'Минимальная версия сохраняет вход в привычку. Она не заменяет полноценную работу — и не должна.';

export const MAX_ACTIVE_HABITS = 2;

export function canAddHabit(state: AppState): boolean {
  return state.habits.filter((h) => h.active).length < MAX_ACTIVE_HABITS;
}
