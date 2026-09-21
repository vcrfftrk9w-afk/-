import { id } from '../lib/id';
import { isoDate } from '../lib/date';
import type { AppState, Mode, Profile, Stage, Task } from '../domain/types';
import type { TrackTemplate } from '../domain/templates';

export const STATE_VERSION = 1;

export function createInitialState(now = new Date()): AppState {
  return {
    version: STATE_VERSION,
    profile: null,
    goal: null,
    stages: [],
    tasks: [],
    habits: [],
    habitLogs: [],
    parking: [],
    commitments: [],
    sessions: [],
    events: [],
    money: {
      currency: '₽',
      monthlyIncome: 0,
      mandatoryExpenses: 0,
      reserve: 0,
      debts: [],
      snapshots: [],
      outcomes: [],
    },
    reviews: [],
    day: { date: isoDate(now), capacity: 'normal', windowMin: 25 },
    settings: { theme: 'system', externalAI: false, notifications: false },
  };
}

/** Настройки доступности включаются по отдельности. Диагноз для них не нужен. */
export function defaultFeatures(mode: Mode) {
  return {
    singleTask: mode === 'adhd',
    visualTimer: true,
    softLanding: mode === 'adhd',
    switchHelp: mode === 'adhd',
    gamification: true,
    fewOptions: mode === 'adhd',
  };
}

export function makeProfile(input: Omit<Profile, 'createdAt' | 'features'> & { features?: Profile['features'] }): Profile {
  return {
    ...input,
    features: input.features ?? defaultFeatures(input.mode),
    createdAt: new Date().toISOString(),
  };
}

export interface GoalFromTrack {
  goalId: string;
  stages: Stage[];
  tasks: Task[];
}

/** Разворачиваем шаблон пути в этапы и конкретные задания. */
export function materializeTrack(track: TrackTemplate, goalId: string, now = new Date()): GoalFromTrack {
  const stages: Stage[] = [];
  const tasks: Task[] = [];

  track.stages.forEach((stageSeed, stageIndex) => {
    const stage: Stage = {
      id: id('stage'),
      goalId,
      title: stageSeed.title,
      order: stageIndex,
    };
    stages.push(stage);

    stageSeed.tasks.forEach((seed, taskIndex) => {
      tasks.push({
        id: id('task'),
        title: seed.title,
        firstStep: seed.firstStep,
        firstStepMin: seed.firstStepMin,
        estimateMin: seed.estimateMin,
        kind: seed.kind,
        status: 'todo',
        stageId: stage.id,
        createdAt: now.toISOString(),
        postponedCount: 0,
        postponeReasons: [],
        simplifyLevel: 0,
        ladder: seed.ladder,
        order: stageIndex * 10 + taskIndex,
      });
    });
  });

  return { goalId, stages, tasks };
}
