import { currentStep } from './simplify';
import type { AppState, Capacity, Habit, Task } from './types';
import { isoDate, timeToMinutes } from '../lib/date';

export interface NextStep {
  task: Task;
  /** Что показываем на главном экране: текущая ступень упрощения. */
  stepText: string;
  stepMinutes: number;
  /** Почему именно это действие. Человек имеет право знать. */
  reason: string;
  /** Задача буксует: её уже переносили. */
  friction: boolean;
  /** Действие идёт от добровольного контракта на это время. */
  fromCommitment: boolean;
}

export interface NextStepContext {
  now: Date;
  windowMin: number;
  capacity: Capacity;
}

const CAPACITY_LIMIT: Record<Capacity, number> = {
  low: 15,
  normal: 45,
  full: 120,
};

/**
 * Главный вопрос приложения: что делать прямо сейчас.
 * Возвращается ровно одно действие — или ничего, и это тоже нормальный ответ.
 */
export function pickNextStep(state: AppState, ctx: NextStepContext): NextStep | null {
  const today = isoDate(ctx.now);
  const nowMin = ctx.now.getHours() * 60 + ctx.now.getMinutes();
  const open = state.tasks.filter((t) => t.status === 'todo');
  if (open.length === 0) return null;

  // 1. Если прямо сейчас идёт заранее выбранный блок — в нём уже всё решено.
  const active = state.commitments.find((c) => {
    if (c.status !== 'planned' || c.date !== today || !c.taskId) return false;
    const start = timeToMinutes(c.start);
    return nowMin >= start - 5 && nowMin <= start + c.durationMin;
  });
  if (active?.taskId) {
    const task = open.find((t) => t.id === active.taskId);
    if (task) return describe(task, 'Ты сам выбрал это время заранее', true, ctx);
  }

  const limit = Math.min(CAPACITY_LIMIT[ctx.capacity], Math.max(ctx.windowMin, 2));
  const stageOrder = new Map(state.stages.map((s) => [s.id, s.order]));
  const activeStageId = firstUnfinishedStageId(state);

  const scored = open
    .map((task) => ({ task, score: score(task, { today, limit, activeStageId, stageOrder, state, ctx }) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;
  return describe(best.task, reasonFor(best.task, activeStageId, today, ctx), false, ctx);
}

interface ScoreCtx {
  today: string;
  limit: number;
  activeStageId?: string;
  stageOrder: Map<string, number>;
  state: AppState;
  ctx: NextStepContext;
}

function score(task: Task, s: ScoreCtx): number {
  let value = 0;
  const step = currentStep(task);

  if (task.scheduledFor === s.today) value += 40;
  if (task.scheduledFor && task.scheduledFor < s.today) value += 12; // просроченное всплывает, но не давит
  if (task.stageId && task.stageId === s.activeStageId) value += 22;

  // Помещается ли действие в реальное окно и в сегодняшние силы.
  if (step.minutes <= s.limit) value += 18;
  else value -= Math.min(30, (step.minutes - s.limit) / 2);

  // Мало сил — тяжёлое не предлагаем вовсе.
  if (s.ctx.capacity === 'low' && step.minutes > 15) value -= 25;

  // Буксующее нужно показать и упростить, а не спрятать.
  value += Math.min(task.postponedCount, 3) * 7;

  // Если человек много готовился и ничего не проверял — подталкиваем к внешнему шагу.
  if (task.kind === 'reality' && needsRealityCheck(s.state)) value += 20;

  // Порядок внутри этапа.
  const stagePos = task.stageId ? s.stageOrder.get(task.stageId) ?? 99 : 99;
  value -= stagePos * 2;
  value -= task.order * 0.5;

  // Привычки не вытесняют главное дело, но и не теряются.
  if (task.habitId) value += 6;

  return value;
}

function describe(task: Task, reason: string, fromCommitment: boolean, _ctx: NextStepContext): NextStep {
  const step = currentStep(task);
  return {
    task,
    stepText: step.text,
    stepMinutes: step.minutes,
    reason,
    friction: task.postponedCount >= 2,
    fromCommitment,
  };
}

function reasonFor(task: Task, activeStageId: string | undefined, today: string, ctx: NextStepContext): string {
  if (task.postponedCount >= 2) return 'Эту задачу уже переносили — попробуем маленькую версию';
  if (task.scheduledFor === today) return 'Запланировано на сегодня';
  if (ctx.capacity === 'low') return 'Подобрано под сегодняшние силы';
  if (task.kind === 'reality') return 'Это внешний шаг: он двигает цель заметнее подготовки';
  if (task.stageId && task.stageId === activeStageId) return 'Текущий этап пути';
  if (task.habitId) return 'Поддерживающая привычка';
  return 'Помещается в свободное окно';
}

export function firstUnfinishedStageId(state: AppState): string | undefined {
  return [...state.stages]
    .sort((a, b) => a.order - b.order)
    .find((s) => !s.doneAt)?.id;
}

/**
 * Просмотр курса — полезная подготовка. Отправленная заявка — другое событие.
 * Если подготовки много, а внешних шагов нет, система предлагает маленький внешний шаг.
 */
export function needsRealityCheck(state: AppState): boolean {
  const done = state.tasks.filter((t) => t.status === 'done');
  const prep = done.filter((t) => t.kind === 'prep').length;
  const reality = done.filter((t) => t.kind === 'reality').length;
  return prep >= 5 && reality === 0;
}

/** Какие привычки ждут сегодня и на каком уровне их разумно предложить. */
export function habitsForToday(state: AppState, date = isoDate()): Array<{ habit: Habit; doneToday: boolean }> {
  return state.habits
    .filter((h) => h.active)
    .map((habit) => ({
      habit,
      doneToday: state.habitLogs.some((l) => l.habitId === habit.id && l.date === date),
    }));
}

/**
 * Пропущенные задачи не превращаются автоматически в долг на завтра.
 * Они попадают в переоценку: оставить, упростить или удалить.
 */
export function tasksNeedingReview(state: AppState, today = isoDate()): Task[] {
  return state.tasks.filter(
    (t) => t.status === 'todo' && t.scheduledFor !== undefined && t.scheduledFor < today,
  );
}

export function suggestedWindow(state: AppState, now = new Date()): number {
  const hour = now.getHours();
  const daily = state.profile?.dailyMinutes ?? 30;
  if (hour < 9) return Math.min(15, daily);
  if (hour >= 22) return Math.min(10, daily);
  return Math.min(daily, 50);
}
