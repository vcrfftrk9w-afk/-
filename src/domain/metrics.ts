import type { AppState, Outcome } from './types';
import { addDays, isoDate, partOfDay, PART_OF_DAY_RU } from '../lib/date';

export interface WeekMetrics {
  from: string;
  to: string;
  /** Сколько важных действий завершено. */
  done: number;
  /** Сколько из них были внешними шагами, а не подготовкой. */
  realityChecks: number;
  prep: number;
  /** Как часто удаётся начать запланированное. */
  startedPlanned: number;
  plannedTotal: number;
  startRate: number | null;
  postponed: number;
  simplified: number;
  stuckUsed: number;
  focusMinutes: number;
  /** Насколько посильной ощущалась нагрузка: доля дней с низкими силами. */
  lowEnergyDays: number;
  outcomes: Outcome[];
}

export function weekMetrics(state: AppState, today = isoDate()): WeekMetrics {
  const from = addDays(today, -6);
  const inWeek = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= today;

  const events = state.events.filter((e) => inWeek(e.at));
  const doneTasks = state.tasks.filter((t) => t.doneAt && inWeek(t.doneAt));
  const planned = state.tasks.filter((t) => t.scheduledFor && t.scheduledFor >= from && t.scheduledFor <= today);
  const startedIds = new Set(events.filter((e) => e.type === 'task_started').map((e) => e.taskId));
  const startedPlanned = planned.filter((t) => startedIds.has(t.id)).length;

  const focusMinutes = state.sessions
    .filter((s) => s.endedAt && inWeek(s.endedAt))
    .reduce((sum, s) => {
      const start = new Date(s.startedAt).getTime();
      const end = new Date(s.endedAt as string).getTime();
      return sum + Math.max(0, Math.round((end - start) / 60000));
    }, 0);

  return {
    from,
    to: today,
    done: doneTasks.length,
    realityChecks: doneTasks.filter((t) => t.kind === 'reality').length,
    prep: doneTasks.filter((t) => t.kind === 'prep').length,
    startedPlanned,
    plannedTotal: planned.length,
    startRate: planned.length ? startedPlanned / planned.length : null,
    postponed: events.filter((e) => e.type === 'task_postponed').length,
    simplified: events.filter((e) => e.type === 'task_simplified').length,
    stuckUsed: events.filter((e) => e.type === 'stuck').length,
    focusMinutes,
    lowEnergyDays: events.filter((e) => e.meta?.capacity === 'low').length,
    outcomes: state.money.outcomes.filter((o) => inWeek(o.at)),
  };
}

export interface TimeOfDayStat {
  part: 'morning' | 'day' | 'evening';
  started: number;
  done: number;
  label: string;
}

/** Какие условия помогают сосредоточиться — по фактам, а не по ощущениям. */
export function timeOfDayStats(state: AppState): TimeOfDayStat[] {
  const parts: Array<'morning' | 'day' | 'evening'> = ['morning', 'day', 'evening'];
  return parts.map((part) => {
    const related = state.events.filter((e) => partOfDay(e.hour) === part);
    return {
      part,
      started: related.filter((e) => e.type === 'task_started').length,
      done: related.filter((e) => e.type === 'task_done').length,
      label: PART_OF_DAY_RU[part],
    };
  });
}

/**
 * Главная метрика самого приложения: помогает ли оно делать важное вне приложения.
 * Поэтому считаем завершённые действия и внешние результаты, а не число открытий.
 */
export function outsideImpact(state: AppState): { actions: number; outcomes: number } {
  return {
    actions: state.tasks.filter((t) => t.status === 'done').length,
    outcomes: state.money.outcomes.length,
  };
}

/** Виртуальный город растёт от значимых действий. За пропуск он не разрушается. */
export function cityLevel(state: AppState): number {
  const stages = state.stages.filter((s) => s.doneAt).length;
  const reality = state.tasks.filter((t) => t.status === 'done' && t.kind === 'reality').length;
  return stages * 2 + reality;
}

export const APP_METRIC_NOTE =
  'Часы работы и деньги здесь — не оценка личности. Можно много работать над неподходящей стратегией: тогда меняют стратегию, а не поднимают планку.';
