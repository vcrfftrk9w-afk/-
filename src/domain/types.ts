/**
 * Доменная модель «Следующего шага».
 *
 * Главные принципы, зашитые в типы:
 *  — одновременно активны одна большая цель и максимум две привычки;
 *  — у каждой задачи есть первый шаг на 1–5 минут и лестница упрощения;
 *  — система различает подготовку и проверку реальностью;
 *  — перенос задачи фиксируется с причиной, а не превращается в молчаливый долг.
 */

export type Mode = 'normal' | 'adhd';

/** Уровень добровольного контракта с собой. */
export type Strictness = 'soft' | 'structured' | 'strict';

/** Сколько сил сегодня. Выбирает человек, система не ставит диагнозов. */
export type Capacity = 'low' | 'normal' | 'full';

export type LifeContext = 'study' | 'job' | 'job_search' | 'own_business';

/** Что мешает больше всего — ответ на онбординге. */
export type MainObstacle = 'start' | 'distraction' | 'forget' | 'overload';

/** Подготовка или проверка реальностью. Разница принципиальная. */
export type TaskKind = 'prep' | 'reality';

export type TaskStatus = 'todo' | 'done' | 'dropped';

export type StuckReason = 'unclear' | 'fear' | 'distraction' | 'no_energy';

export type PostponeReason =
  | 'no_time'
  | 'too_big'
  | 'unclear'
  | 'no_energy'
  | 'not_important'
  | 'other';

export interface Profile {
  createdAt: string;
  context: LifeContext;
  obstacle: MainObstacle;
  /** Реально свободные минуты в будний день. */
  dailyMinutes: number;
  hasDebts: boolean;
  mode: Mode;
  strictness: Strictness;
  /** Отдельные настройки доступности. Диагноз для них не нужен. */
  features: FeatureFlags;
}

export interface FeatureFlags {
  /** Один экран — одна задача. */
  singleTask: boolean;
  /** Наглядный таймер, а не только цифры. */
  visualTimer: boolean;
  /** Предупреждение за 3 минуты до конца блока. */
  softLanding: boolean;
  /** Помощь с переключением между делами. */
  switchHelp: boolean;
  /** Виртуальный город и прочее оформление. */
  gamification: boolean;
  /** Сокращённые настройки перед стартом. */
  fewOptions: boolean;
}

export interface Goal {
  id: string;
  /** Ближайшая проверяемая формулировка, а не «хочу стать богатым». */
  title: string;
  /** Как поймём, что цель достигнута. */
  checkpoint: string;
  createdAt: string;
  horizonWeeks: number;
  /** Из какого шаблона выросла цель, если из шаблона. */
  trackId?: string;
  archivedAt?: string;
}

export interface Stage {
  id: string;
  goalId: string;
  title: string;
  order: number;
  doneAt?: string;
}

export interface Task {
  id: string;
  title: string;
  /** Первый шаг на 1–5 минут: то, с чего физически начинается задача. */
  firstStep: string;
  firstStepMin: number;
  estimateMin: number;
  kind: TaskKind;
  status: TaskStatus;
  stageId?: string;
  habitId?: string;
  createdAt: string;
  doneAt?: string;
  droppedAt?: string;
  /** Сколько раз задачу переносили. Нужно, чтобы вовремя упростить. */
  postponedCount: number;
  postponeReasons: PostponeReason[];
  /** На какой ступени упрощения сейчас находимся. */
  simplifyLevel: number;
  /** Собственная лестница упрощения из шаблона, если она есть. */
  ladder?: LadderStep[];
  /** На какой день задача запланирована (YYYY-MM-DD). */
  scheduledFor?: string;
  /** «С чего продолжить» — оставляется в конце фокус-блока. */
  resumeHint?: string;
  /** Задача требует переоценки: день прошёл, она не сделана. */
  needsReview?: boolean;
  order: number;
}

export interface LadderStep {
  text: string;
  minutes: number;
}

export interface Habit {
  id: string;
  title: string;
  /** Якорь-событие, а не только время: «после чистки зубов». */
  anchor: string;
  minVersion: string;
  normalVersion: string;
  extendedVersion: string;
  minMinutes: number;
  normalMinutes: number;
  extendedMinutes: number;
  createdAt: string;
  active: boolean;
}

export type HabitLevel = 'min' | 'normal' | 'extended';

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  level: HabitLevel;
}

export interface ParkedIdea {
  id: string;
  text: string;
  createdAt: string;
}

/** Добровольный контракт: время старта, выбранное заранее. */
export interface Commitment {
  id: string;
  taskId?: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  start: string;
  durationMin: number;
  strictness: Strictness;
  /** Что человек сам решил ограничить на это время. */
  limited: string[];
  createdAt: string;
  status: 'planned' | 'done' | 'skipped';
}

export interface FocusSession {
  id: string;
  taskId?: string;
  intent: string;
  plannedMin: number;
  startedAt: string;
  endedAt?: string;
  /** Работали рядом с кем-то или в одиночку. */
  companion: 'solo' | 'auto' | 'partner';
  result?: string;
  resumeHint?: string;
  interrupted: boolean;
}

export type AppEventType =
  | 'task_started'
  | 'task_done'
  | 'task_simplified'
  | 'task_postponed'
  | 'task_dropped'
  | 'stuck'
  | 'focus_started'
  | 'focus_finished'
  | 'habit_done'
  | 'commitment_kept'
  | 'commitment_missed';

export interface AppEvent {
  id: string;
  type: AppEventType;
  at: string;
  taskId?: string;
  /** Час суток, чтобы потом честно считать, когда легче начинать. */
  hour: number;
  meta?: Record<string, string | number>;
}

export interface Debt {
  id: string;
  name: string;
  amount: number;
}

export interface MoneyState {
  currency: string;
  monthlyIncome: number;
  mandatoryExpenses: number;
  reserve: number;
  debts: Debt[];
  /** Один основной путь роста дохода. */
  trackId?: string;
  /** Ежемесячные срезы: доход, расходы, резерв. */
  snapshots: MoneySnapshot[];
  /** Внешние результаты: отклики, собеседования, заявки, оплаты. */
  outcomes: Outcome[];
}

export interface MoneySnapshot {
  id: string;
  month: string;
  income: number;
  expenses: number;
  reserve: number;
}

export type OutcomeKind =
  | 'portfolio'
  | 'application'
  | 'conversation'
  | 'interview'
  | 'offer'
  | 'payment';

export interface Outcome {
  id: string;
  kind: OutcomeKind;
  note: string;
  amount?: number;
  at: string;
}

export interface WeeklyReview {
  id: string;
  weekStart: string;
  movedForward: string;
  tooHeavy: string;
  removeNextWeek: string;
  /** Гипотеза на следующую неделю, а не приговор. */
  hypothesis: string;
  acceptedHypothesis: boolean;
  createdAt: string;
}

export interface DayState {
  date: string;
  capacity: Capacity;
  /** Свободное окно прямо сейчас, в минутах. */
  windowMin: number;
}

export interface Settings {
  theme: 'system' | 'dark' | 'light';
  /** Отправка содержимого задач внешнему ИИ. По умолчанию выключено. */
  externalAI: boolean;
  notifications: boolean;
  partnerName?: string;
}

export interface AppState {
  version: number;
  profile: Profile | null;
  goal: Goal | null;
  stages: Stage[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  parking: ParkedIdea[];
  commitments: Commitment[];
  sessions: FocusSession[];
  events: AppEvent[];
  money: MoneyState;
  reviews: WeeklyReview[];
  day: DayState;
  settings: Settings;
}
