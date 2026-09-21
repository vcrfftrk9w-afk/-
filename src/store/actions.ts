import type {
  AppState,
  Capacity,
  Commitment,
  FocusSession,
  Habit,
  HabitLevel,
  Mode,
  Outcome,
  PostponeReason,
  Profile,
  Settings,
  Strictness,
  StuckReason,
  Task,
  WeeklyReview,
} from '../domain/types';
import type { TrackTemplate } from '../domain/templates';

export type Action =
  | { type: 'onboarding/complete'; profile: Profile; track?: TrackTemplate; goalTitle: string; goalCheckpoint: string; habits: Habit[] }
  | { type: 'day/set'; capacity?: Capacity; windowMin?: number; date?: string }
  | { type: 'task/add'; task: Omit<Task, 'id' | 'createdAt' | 'postponedCount' | 'postponeReasons' | 'simplifyLevel' | 'order' | 'status'> & { order?: number } }
  | { type: 'task/start'; taskId: string }
  | { type: 'task/done'; taskId: string; resumeHint?: string }
  | { type: 'task/simplify'; taskId: string }
  | { type: 'task/postpone'; taskId: string; reason: PostponeReason; until?: string }
  | { type: 'task/drop'; taskId: string }
  | { type: 'task/schedule'; taskId: string; date?: string }
  | { type: 'task/resumeHint'; taskId: string; hint: string }
  | { type: 'stuck/log'; reason: StuckReason; taskId?: string }
  | { type: 'parking/add'; text: string }
  | { type: 'parking/remove'; ideaId: string }
  | { type: 'parking/promote'; ideaId: string }
  | { type: 'habit/add'; habit: Habit }
  | { type: 'habit/log'; habitId: string; level: HabitLevel; date?: string }
  | { type: 'habit/unlog'; habitId: string; date?: string }
  | { type: 'habit/toggle'; habitId: string }
  | { type: 'commitment/add'; commitment: Commitment }
  | { type: 'commitment/status'; commitmentId: string; status: Commitment['status'] }
  | { type: 'commitment/remove'; commitmentId: string }
  | { type: 'session/start'; session: FocusSession }
  | { type: 'session/end'; sessionId: string; result?: string; resumeHint?: string; interrupted?: boolean }
  | { type: 'money/update'; patch: Partial<Pick<AppState['money'], 'monthlyIncome' | 'mandatoryExpenses' | 'reserve' | 'currency'>> }
  | { type: 'money/debt-add'; name: string; amount: number }
  | { type: 'money/debt-remove'; debtId: string }
  | { type: 'money/snapshot' }
  | { type: 'money/outcome-add'; outcome: Omit<Outcome, 'id' | 'at'> }
  | { type: 'money/outcome-remove'; outcomeId: string }
  | { type: 'money/track'; track: TrackTemplate; replaceGoal: boolean }
  | { type: 'review/add'; review: Omit<WeeklyReview, 'id' | 'createdAt'> }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'profile/mode'; mode: Mode }
  | { type: 'profile/strictness'; strictness: Strictness }
  | { type: 'profile/feature'; key: keyof Profile['features']; value: boolean }
  | { type: 'profile/dailyMinutes'; minutes: number }
  | { type: 'state/import'; state: AppState }
  | { type: 'state/reset' };
