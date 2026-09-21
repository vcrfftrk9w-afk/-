import { id } from '../lib/id';
import { isoDate, isoMonth } from '../lib/date';
import { buildLadder } from '../domain/simplify';
import type { AppEvent, AppEventType, AppState, Task } from '../domain/types';
import type { Action } from './actions';
import { createInitialState, materializeTrack } from './state';

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'onboarding/complete': {
      const goalId = id('goal');
      const base = action.track ? materializeTrack(action.track, goalId) : { stages: [], tasks: [] };
      return {
        ...state,
        profile: action.profile,
        goal: {
          id: goalId,
          title: action.goalTitle,
          checkpoint: action.goalCheckpoint,
          createdAt: new Date().toISOString(),
          horizonWeeks: action.track?.horizonWeeks ?? 12,
          trackId: action.track?.id,
        },
        stages: base.stages,
        tasks: base.tasks,
        habits: action.habits,
        money: { ...state.money, trackId: action.track?.id ?? state.money.trackId },
      };
    }

    case 'day/set':
      return {
        ...state,
        day: {
          date: action.date ?? state.day.date,
          capacity: action.capacity ?? state.day.capacity,
          windowMin: action.windowMin ?? state.day.windowMin,
        },
      };

    case 'task/add': {
      const task: Task = {
        ...action.task,
        id: id('task'),
        status: 'todo',
        createdAt: new Date().toISOString(),
        postponedCount: 0,
        postponeReasons: [],
        simplifyLevel: 0,
        order: action.task.order ?? state.tasks.length,
      };
      return { ...state, tasks: [...state.tasks, task] };
    }

    case 'task/start':
      return logEvent(state, 'task_started', { taskId: action.taskId });

    case 'task/done': {
      const now = new Date().toISOString();
      const tasks = state.tasks.map((t) =>
        t.id === action.taskId
          ? { ...t, status: 'done' as const, doneAt: now, needsReview: false, resumeHint: action.resumeHint ?? t.resumeHint }
          : t,
      );
      const withStages = closeFinishedStages({ ...state, tasks });
      return logEvent(withStages, 'task_done', { taskId: action.taskId });
    }

    case 'task/simplify': {
      const tasks = state.tasks.map((t) => {
        if (t.id !== action.taskId) return t;
        const max = buildLadder(t).length - 1;
        return { ...t, simplifyLevel: Math.min(t.simplifyLevel + 1, max) };
      });
      return logEvent({ ...state, tasks }, 'task_simplified', { taskId: action.taskId });
    }

    case 'task/postpone': {
      // Перенос всегда с причиной: это данные для недельного разбора,
      // а не молчаливый долг на завтра.
      const tasks = state.tasks.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              postponedCount: t.postponedCount + 1,
              postponeReasons: [...t.postponeReasons, action.reason],
              scheduledFor: action.until,
              needsReview: !action.until,
            }
          : t,
      );
      return logEvent({ ...state, tasks }, 'task_postponed', {
        taskId: action.taskId,
        meta: { reason: action.reason },
      });
    }

    case 'task/drop': {
      const now = new Date().toISOString();
      const tasks = state.tasks.map((t) =>
        t.id === action.taskId ? { ...t, status: 'dropped' as const, droppedAt: now, needsReview: false } : t,
      );
      return logEvent({ ...state, tasks }, 'task_dropped', { taskId: action.taskId });
    }

    case 'task/schedule': {
      const tasks = state.tasks.map((t) =>
        t.id === action.taskId ? { ...t, scheduledFor: action.date, needsReview: false } : t,
      );
      return { ...state, tasks };
    }

    case 'task/resumeHint': {
      const tasks = state.tasks.map((t) => (t.id === action.taskId ? { ...t, resumeHint: action.hint } : t));
      return { ...state, tasks };
    }

    case 'stuck/log':
      return logEvent(state, 'stuck', { taskId: action.taskId, meta: { reason: action.reason } });

    case 'parking/add':
      return {
        ...state,
        parking: [
          { id: id('idea'), text: action.text, createdAt: new Date().toISOString() },
          ...state.parking,
        ],
      };

    case 'parking/remove':
      return { ...state, parking: state.parking.filter((p) => p.id !== action.ideaId) };

    case 'parking/promote': {
      const idea = state.parking.find((p) => p.id === action.ideaId);
      if (!idea) return state;
      const task: Task = {
        id: id('task'),
        title: idea.text,
        firstStep: 'Открыть то, где это делается, и сделать одну строку',
        firstStepMin: 2,
        estimateMin: 20,
        kind: 'prep',
        status: 'todo',
        createdAt: new Date().toISOString(),
        postponedCount: 0,
        postponeReasons: [],
        simplifyLevel: 0,
        order: state.tasks.length,
      };
      return {
        ...state,
        tasks: [...state.tasks, task],
        parking: state.parking.filter((p) => p.id !== action.ideaId),
      };
    }

    case 'habit/add':
      return { ...state, habits: [...state.habits, action.habit] };

    case 'habit/log': {
      const date = action.date ?? isoDate();
      const exists = state.habitLogs.some((l) => l.habitId === action.habitId && l.date === date);
      if (exists) return state;
      const next = {
        ...state,
        habitLogs: [...state.habitLogs, { id: id('hl'), habitId: action.habitId, date, level: action.level }],
      };
      return logEvent(next, 'habit_done', { meta: { habitId: action.habitId, level: action.level } });
    }

    case 'habit/unlog': {
      const date = action.date ?? isoDate();
      return {
        ...state,
        habitLogs: state.habitLogs.filter((l) => !(l.habitId === action.habitId && l.date === date)),
      };
    }

    case 'habit/toggle':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.habitId ? { ...h, active: !h.active } : h)),
      };

    case 'commitment/add':
      return { ...state, commitments: [...state.commitments, action.commitment] };

    case 'commitment/status': {
      const commitments = state.commitments.map((c) =>
        c.id === action.commitmentId ? { ...c, status: action.status } : c,
      );
      const next = { ...state, commitments };
      if (action.status === 'done') return logEvent(next, 'commitment_kept');
      if (action.status === 'skipped') return logEvent(next, 'commitment_missed');
      return next;
    }

    case 'commitment/remove':
      return { ...state, commitments: state.commitments.filter((c) => c.id !== action.commitmentId) };

    case 'session/start':
      return logEvent({ ...state, sessions: [...state.sessions, action.session] }, 'focus_started', {
        taskId: action.session.taskId,
      });

    case 'session/end': {
      const sessions = state.sessions.map((s) =>
        s.id === action.sessionId
          ? {
              ...s,
              endedAt: new Date().toISOString(),
              result: action.result,
              resumeHint: action.resumeHint,
              interrupted: action.interrupted ?? false,
            }
          : s,
      );
      const session = sessions.find((s) => s.id === action.sessionId);
      let tasks = state.tasks;
      if (session?.taskId && action.resumeHint) {
        tasks = tasks.map((t) => (t.id === session.taskId ? { ...t, resumeHint: action.resumeHint } : t));
      }
      return logEvent({ ...state, sessions, tasks }, 'focus_finished', { taskId: session?.taskId });
    }

    case 'money/update':
      return { ...state, money: { ...state.money, ...action.patch } };

    case 'money/debt-add':
      return {
        ...state,
        money: {
          ...state.money,
          debts: [...state.money.debts, { id: id('debt'), name: action.name, amount: action.amount }],
        },
      };

    case 'money/debt-remove':
      return {
        ...state,
        money: { ...state.money, debts: state.money.debts.filter((d) => d.id !== action.debtId) },
      };

    case 'money/snapshot': {
      const month = isoMonth();
      const snapshot = {
        id: id('snap'),
        month,
        income: state.money.monthlyIncome,
        expenses: state.money.mandatoryExpenses,
        reserve: state.money.reserve,
      };
      return {
        ...state,
        money: {
          ...state.money,
          snapshots: [...state.money.snapshots.filter((s) => s.month !== month), snapshot].sort((a, b) =>
            a.month.localeCompare(b.month),
          ),
        },
      };
    }

    case 'money/outcome-add':
      return {
        ...state,
        money: {
          ...state.money,
          outcomes: [{ ...action.outcome, id: id('out'), at: new Date().toISOString() }, ...state.money.outcomes],
        },
      };

    case 'money/outcome-remove':
      return {
        ...state,
        money: { ...state.money, outcomes: state.money.outcomes.filter((o) => o.id !== action.outcomeId) },
      };

    case 'money/track': {
      // Одновременно активна максимум одна большая цель.
      const goalId = id('goal');
      const built = materializeTrack(action.track, goalId);
      if (!action.replaceGoal && state.goal) {
        return { ...state, money: { ...state.money, trackId: action.track.id } };
      }
      const archivedTasks = state.tasks.map((t) =>
        t.status === 'todo' && t.stageId ? { ...t, status: 'dropped' as const, droppedAt: new Date().toISOString() } : t,
      );
      return {
        ...state,
        goal: {
          id: goalId,
          title: action.track.goalTitle,
          checkpoint: action.track.goalCheckpoint,
          createdAt: new Date().toISOString(),
          horizonWeeks: action.track.horizonWeeks,
          trackId: action.track.id,
        },
        stages: built.stages,
        tasks: [...archivedTasks.filter((t) => t.status !== 'dropped' || t.doneAt), ...built.tasks],
        money: { ...state.money, trackId: action.track.id },
      };
    }

    case 'review/add':
      return {
        ...state,
        reviews: [
          { ...action.review, id: id('rev'), createdAt: new Date().toISOString() },
          ...state.reviews,
        ],
      };

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'profile/mode':
      return state.profile ? { ...state, profile: { ...state.profile, mode: action.mode } } : state;

    case 'profile/strictness':
      return state.profile ? { ...state, profile: { ...state.profile, strictness: action.strictness } } : state;

    case 'profile/feature':
      return state.profile
        ? {
            ...state,
            profile: {
              ...state.profile,
              features: { ...state.profile.features, [action.key]: action.value },
            },
          }
        : state;

    case 'profile/dailyMinutes':
      return state.profile ? { ...state, profile: { ...state.profile, dailyMinutes: action.minutes } } : state;

    case 'state/import':
      return action.state;

    case 'state/reset':
      return createInitialState();

    default:
      return state;
  }
}

interface EventInput {
  taskId?: string;
  meta?: Record<string, string | number>;
}

function logEvent(state: AppState, type: AppEventType, input: EventInput = {}): AppState {
  const now = new Date();
  const event: AppEvent = {
    id: id('ev'),
    type,
    at: now.toISOString(),
    hour: now.getHours(),
    taskId: input.taskId,
    meta: { capacity: state.day.capacity, ...(input.meta ?? {}) },
  };
  // Журнал нужен для честных гипотез, а не для слежки: он никуда не уходит.
  return { ...state, events: [...state.events.slice(-999), event] };
}

/** Этап закрывается сам, когда в нём не осталось незавершённых задач. */
function closeFinishedStages(state: AppState): AppState {
  const now = new Date().toISOString();
  const stages = state.stages.map((stage) => {
    if (stage.doneAt) return stage;
    const tasks = state.tasks.filter((t) => t.stageId === stage.id);
    if (tasks.length === 0) return stage;
    const open = tasks.some((t) => t.status === 'todo');
    return open ? stage : { ...stage, doneAt: now };
  });
  return { ...state, stages };
}
