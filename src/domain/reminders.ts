import type { AppState, Commitment } from './types';
import { isoDate, timeToMinutes } from '../lib/date';

export type ReminderKind = 'due' | 'again';

export interface Reminder {
  commitment: Commitment;
  kind: ReminderKind;
  title: string;
  body: string;
}

const REPEAT_AFTER_MIN = 10;

/**
 * Мягкий уровень: одно напоминание.
 * Собранный и строгий: повторный запрос, если не начал — но без давления и обвинений.
 */
export function dueReminder(state: AppState, now = new Date()): Reminder | null {
  const today = isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const candidates = state.commitments
    .filter((c) => c.date === today && c.status === 'planned')
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  for (const c of candidates) {
    const start = timeToMinutes(c.start);
    const started = state.sessions.some(
      (s) => s.taskId && s.taskId === c.taskId && isoDate(new Date(s.startedAt)) === today,
    );
    if (started) continue;

    if (nowMin >= start && nowMin < start + REPEAT_AFTER_MIN) {
      return {
        commitment: c,
        kind: 'due',
        title: `Время, которое ты выбрал: ${c.start}`,
        body: `${c.title} — ${c.durationMin} минут. Договорённость уже принята, заново уговаривать себя не нужно.`,
      };
    }

    const repeats = c.strictness !== 'soft';
    if (repeats && nowMin >= start + REPEAT_AFTER_MIN && nowMin <= start + c.durationMin) {
      return {
        commitment: c,
        kind: 'again',
        title: 'Не начал в назначенное время',
        body: 'Это не провал. Возьмём маленькую версию: первый шаг на две минуты — или перенесём с причиной.',
      };
    }
  }
  return null;
}
