import { describe, expect, it } from 'vitest';
import { pickNextStep, needsRealityCheck, tasksNeedingReview } from './engine';
import { buildLadder, canSimplify, currentStep } from './simplify';
import { habitStats } from './habits';
import { buildHypothesis } from './review';
import { dueReminder } from './reminders';
import { weekMetrics } from './metrics';
import { reducer } from '../store/reducer';
import { createInitialState, materializeTrack } from '../store/state';
import { TRACKS } from './templates';
import { addDays, isoDate } from '../lib/date';
import type { AppState, Task } from './types';

function task(patch: Partial<Task> = {}): Task {
  return {
    id: patch.id ?? 't1',
    title: 'Обновить резюме',
    firstStep: 'Открыть файл резюме',
    firstStepMin: 2,
    estimateMin: 20,
    kind: 'prep',
    status: 'todo',
    createdAt: new Date().toISOString(),
    postponedCount: 0,
    postponeReasons: [],
    simplifyLevel: 0,
    order: 0,
    ...patch,
  };
}

function stateWith(tasks: Task[]): AppState {
  return { ...createInitialState(), tasks };
}

const ctx = { now: new Date('2026-09-21T14:00:00'), windowMin: 25, capacity: 'normal' as const };

describe('следующий шаг', () => {
  it('показывает ровно одно действие', () => {
    const next = pickNextStep(stateWith([task({ id: 'a' }), task({ id: 'b', title: 'Другое' })]), ctx);
    expect(next?.task.id).toBeDefined();
    expect(next?.stepText).toBe('Обновить резюме');
  });

  it('возвращает null, когда открытых задач нет', () => {
    expect(pickNextStep(stateWith([]), ctx)).toBeNull();
  });

  it('при малых силах не предлагает тяжёлое', () => {
    const heavy = task({ id: 'heavy', title: 'Большая задача', estimateMin: 90 });
    const light = task({ id: 'light', title: 'Маленькая задача', estimateMin: 10 });
    const next = pickNextStep(stateWith([heavy, light]), { ...ctx, capacity: 'low', windowMin: 15 });
    expect(next?.task.id).toBe('light');
  });

  it('помечает буксующую задачу и объясняет причину выбора', () => {
    const stuck = task({ id: 'stuck', postponedCount: 3 });
    const next = pickNextStep(stateWith([stuck]), ctx);
    expect(next?.friction).toBe(true);
    expect(next?.reason).toContain('переносили');
  });

  it('действие по контракту выигрывает у остальных', () => {
    const base = stateWith([task({ id: 'a' }), task({ id: 'b', title: 'Договорённая задача' })]);
    const state: AppState = {
      ...base,
      commitments: [
        {
          id: 'c1',
          taskId: 'b',
          title: 'Портфолио',
          date: isoDate(ctx.now),
          start: '14:00',
          durationMin: 25,
          strictness: 'strict',
          limited: ['короткие видео'],
          createdAt: new Date().toISOString(),
          status: 'planned',
        },
      ],
    };
    const next = pickNextStep(state, ctx);
    expect(next?.task.id).toBe('b');
    expect(next?.fromCommitment).toBe(true);
  });
});

describe('упрощение', () => {
  it('снижает порог входа шаг за шагом', () => {
    const t = task();
    const ladder = buildLadder(t);
    expect(ladder[0].text).toBe('Обновить резюме');
    expect(ladder[ladder.length - 1].minutes).toBeLessThanOrEqual(2);
    expect(currentStep(t).text).toBe('Обновить резюме');
    expect(currentStep({ ...t, simplifyLevel: 2 }).minutes).toBeLessThan(t.estimateMin);
  });

  it('использует лестницу из шаблона, если она есть', () => {
    const t = task({
      ladder: [
        { text: 'Обновить резюме', minutes: 20 },
        { text: 'Открыть файл', minutes: 2 },
      ],
    });
    expect(buildLadder(t)).toHaveLength(2);
    expect(canSimplify({ ...t, simplifyLevel: 1 })).toBe(false);
  });

  it('упрощение не уходит ниже последней ступени', () => {
    let state = stateWith([task({ id: 'a' })]);
    for (let i = 0; i < 10; i += 1) state = reducer(state, { type: 'task/simplify', taskId: 'a' });
    const t = state.tasks[0];
    expect(t.simplifyLevel).toBe(buildLadder(t).length - 1);
  });
});

describe('переносы и переоценка', () => {
  it('перенос без даты уходит в переоценку, а не в долг на завтра', () => {
    const state = reducer(stateWith([task({ id: 'a' })]), {
      type: 'task/postpone',
      taskId: 'a',
      reason: 'no_energy',
    });
    expect(state.tasks[0].needsReview).toBe(true);
    expect(state.tasks[0].postponedCount).toBe(1);
    expect(state.tasks[0].postponeReasons).toEqual(['no_energy']);
  });

  it('вчерашние незакрытые задачи попадают в переоценку', () => {
    const yesterday = addDays(isoDate(), -1);
    const state = stateWith([task({ id: 'a', scheduledFor: yesterday })]);
    expect(tasksNeedingReview(state)).toHaveLength(1);
  });
});

describe('подготовка и проверка реальностью', () => {
  it('замечает, что подготовки много, а внешних шагов нет', () => {
    const done = Array.from({ length: 5 }, (_, i) =>
      task({ id: `p${i}`, status: 'done', doneAt: new Date().toISOString(), kind: 'prep' }),
    );
    expect(needsRealityCheck(stateWith(done))).toBe(true);
    expect(
      needsRealityCheck(
        stateWith([...done, task({ id: 'r', status: 'done', doneAt: new Date().toISOString(), kind: 'reality' })]),
      ),
    ).toBe(false);
  });

  it('внешний шаг получает приоритет, когда проверок не было', () => {
    const done = Array.from({ length: 5 }, (_, i) =>
      task({ id: `p${i}`, status: 'done', doneAt: new Date().toISOString(), kind: 'prep' }),
    );
    const next = pickNextStep(
      stateWith([...done, task({ id: 'prep-open' }), task({ id: 'reality-open', kind: 'reality' })]),
      ctx,
    );
    expect(next?.task.id).toBe('reality-open');
  });
});

describe('привычки', () => {
  it('не обнуляют прогресс после пропуска', () => {
    let state = createInitialState();
    state = reducer(state, {
      type: 'habit/add',
      habit: {
        id: 'h1',
        title: 'Движение',
        anchor: 'После чистки зубов',
        minVersion: 'Две минуты',
        normalVersion: 'Десять минут',
        extendedVersion: 'Тренировка',
        minMinutes: 2,
        normalMinutes: 10,
        extendedMinutes: 45,
        createdAt: new Date().toISOString(),
        active: true,
      },
    });
    const today = isoDate();
    [0, 1, 3, 4, 6, 7, 9, 10, 12].forEach((d) => {
      state = reducer(state, { type: 'habit/log', habitId: 'h1', level: 'min', date: addDays(today, -d) });
    });
    const stats = habitStats(state, state.habits[0], today);
    expect(stats.doneLast14).toBe(9);
    expect(stats.phrase).toContain('9 раз');
    expect(stats.phrase).not.toContain('потерял');
  });

  it('не логирует привычку дважды за день', () => {
    let state = createInitialState();
    state = reducer(state, {
      type: 'habit/add',
      habit: {
        id: 'h1',
        title: 'Движение',
        anchor: 'После чистки зубов',
        minVersion: 'Две минуты',
        normalVersion: 'Десять минут',
        extendedVersion: 'Тренировка',
        minMinutes: 2,
        normalMinutes: 10,
        extendedMinutes: 45,
        createdAt: new Date().toISOString(),
        active: true,
      },
    });
    state = reducer(state, { type: 'habit/log', habitId: 'h1', level: 'min' });
    state = reducer(state, { type: 'habit/log', habitId: 'h1', level: 'normal' });
    expect(state.habitLogs).toHaveLength(1);
  });
});

describe('цель из шаблона', () => {
  it('разворачивается в этапы и конкретные задания', () => {
    const track = TRACKS.find((t) => t.id === 'freelance');
    expect(track).toBeDefined();
    const built = materializeTrack(track!, 'goal1');
    expect(built.stages.length).toBe(track!.stages.length);
    expect(built.tasks.length).toBeGreaterThan(0);
    expect(built.tasks.every((t) => t.firstStepMin <= 5)).toBe(true);
    expect(built.tasks.some((t) => t.kind === 'reality')).toBe(true);
  });

  it('этап закрывается, когда все его задания завершены', () => {
    const track = TRACKS.find((t) => t.id === 'validate')!;
    const built = materializeTrack(track, 'goal1');
    let state: AppState = { ...createInitialState(), stages: built.stages, tasks: built.tasks };
    const firstStageTasks = built.tasks.filter((t) => t.stageId === built.stages[0].id);
    firstStageTasks.forEach((t) => {
      state = reducer(state, { type: 'task/done', taskId: t.id });
    });
    expect(state.stages[0].doneAt).toBeDefined();
    expect(state.stages[1].doneAt).toBeUndefined();
  });
});

describe('недельный разбор', () => {
  it('гипотеза о переносах появляется, когда упрощение не использовалось', () => {
    let state = stateWith([task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]);
    (['a', 'b', 'c'] as const).forEach((id) => {
      state = reducer(state, { type: 'task/postpone', taskId: id, reason: 'too_big' });
    });
    expect(buildHypothesis(state)).toContain('упрощались');
  });

  it('считает внешние шаги отдельно от подготовки', () => {
    let state = stateWith([task({ id: 'a' }), task({ id: 'b', kind: 'reality' })]);
    state = reducer(state, { type: 'task/done', taskId: 'a' });
    state = reducer(state, { type: 'task/done', taskId: 'b' });
    const m = weekMetrics(state);
    expect(m.done).toBe(2);
    expect(m.prep).toBe(1);
    expect(m.realityChecks).toBe(1);
  });

  it('при пустой неделе не требует наращивать нагрузку', () => {
    expect(buildHypothesis(createInitialState())).toContain('Данных за неделю почти нет');
  });
});

describe('деньги', () => {
  it('записывает внешний результат и срез месяца', () => {
    let state = createInitialState();
    state = reducer(state, { type: 'money/update', patch: { monthlyIncome: 100000, mandatoryExpenses: 60000 } });
    state = reducer(state, { type: 'money/snapshot' });
    state = reducer(state, { type: 'money/outcome-add', outcome: { kind: 'payment', note: 'первый заказ', amount: 5000 } });
    expect(state.money.snapshots).toHaveLength(1);
    expect(state.money.outcomes[0].amount).toBe(5000);
  });

  it('смена пути не стирает уже сделанное', () => {
    const track = TRACKS[0];
    let state = createInitialState();
    state = reducer(state, { type: 'money/track', track, replaceGoal: true });
    const first = state.tasks[0];
    state = reducer(state, { type: 'task/done', taskId: first.id });
    state = reducer(state, { type: 'money/track', track: TRACKS[2], replaceGoal: true });
    expect(state.tasks.some((t) => t.id === first.id && t.status === 'done')).toBe(true);
    expect(state.goal?.trackId).toBe(TRACKS[2].id);
  });
});

describe('договорённости', () => {
  function withCommitment(strictness: 'soft' | 'structured' | 'strict', start: string): AppState {
    return {
      ...stateWith([task({ id: 'a' })]),
      commitments: [
        {
          id: 'c1',
          taskId: 'a',
          title: 'Портфолио',
          date: isoDate(new Date('2026-09-21T19:05:00')),
          start,
          durationMin: 25,
          strictness,
          limited: [],
          createdAt: new Date().toISOString(),
          status: 'planned',
        },
      ],
    };
  }

  it('напоминает в выбранное время', () => {
    const r = dueReminder(withCommitment('structured', '19:00'), new Date('2026-09-21T19:05:00'));
    expect(r?.kind).toBe('due');
    expect(r?.title).toContain('19:00');
  });

  it('на собранном уровне повторяет запрос, если не начал', () => {
    const r = dueReminder(withCommitment('structured', '19:00'), new Date('2026-09-21T19:15:00'));
    expect(r?.kind).toBe('again');
    expect(r?.body).toContain('не провал');
  });

  it('на мягком уровне повторного запроса нет', () => {
    expect(dueReminder(withCommitment('soft', '19:00'), new Date('2026-09-21T19:15:00'))).toBeNull();
  });

  it('молчит, когда блок уже начат', () => {
    const base = withCommitment('strict', '19:00');
    const state: AppState = {
      ...base,
      sessions: [
        {
          id: 's1',
          taskId: 'a',
          intent: 'Портфолио',
          plannedMin: 25,
          startedAt: new Date('2026-09-21T19:01:00').toISOString(),
          companion: 'solo',
          interrupted: false,
        },
      ],
    };
    expect(dueReminder(state, new Date('2026-09-21T19:15:00'))).toBeNull();
  });
});
