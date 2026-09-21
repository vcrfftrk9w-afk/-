import type { AppState } from './types';
import { weekMetrics, timeOfDayStats } from './metrics';
import { isoDate } from '../lib/date';

export interface ReviewQuestion {
  key: 'movedForward' | 'tooHeavy' | 'removeNextWeek';
  question: string;
  hint: string;
}

export const REVIEW_QUESTIONS: ReviewQuestion[] = [
  {
    key: 'movedForward',
    question: 'Что действительно сдвинуло тебя вперёд?',
    hint: 'Не «много работал», а конкретное действие и его результат.',
  },
  {
    key: 'tooHeavy',
    question: 'Где план был слишком тяжёлым или неясным?',
    hint: 'Тяжёлый план — это данные о плане, а не о тебе.',
  },
  {
    key: 'removeNextWeek',
    question: 'Что на следующей неделе уберём или упростим?',
    hint: 'Убрать — нормальный ход. Список не обязан расти.',
  },
];

/**
 * Гипотеза на неделю, а не заявление «ИИ полностью изучил твой мозг».
 * Строится на фактах из журнала событий и всегда требует подтверждения человеком.
 */
export function buildHypothesis(state: AppState, today = isoDate()): string {
  const m = weekMetrics(state, today);
  const parts = timeOfDayStats(state);
  const best = [...parts].sort((a, b) => b.done - a.done)[0];
  const worst = [...parts].sort((a, b) => a.done - b.done)[0];

  if (m.done === 0 && m.postponed === 0) {
    return 'Данных за неделю почти нет. Начнём с одного короткого блока в день — этого достаточно, чтобы появились факты.';
  }

  if (m.postponed >= 3 && m.simplified === 0) {
    return `Задачи переносились ${m.postponed} раза, но ни разу не упрощались. Проверим: на следующей неделе при первом переносе сразу берём маленькую версию.`;
  }

  if (m.prep >= 3 && m.realityChecks === 0) {
    return 'Подготовки много, внешних шагов нет. Проверим гипотезу: один маленький внешний шаг в неделю (отправить, спросить, показать) двигает цель заметнее, чем ещё один материал.';
  }

  if (best && worst && best.done > worst.done && best.done > 0) {
    return `${capitalize(best.label)} задачи чаще доходили до конца, чем ${worst.label}. Проверим два коротких блока ${best.label} на следующей неделе?`;
  }

  if (m.startRate !== null && m.startRate < 0.5) {
    return 'Запланированное начиналось реже, чем в половине случаев. Проверим: меньше пунктов в плане и первый шаг не длиннее двух минут.';
  }

  return 'Неделя прошла ровно. Нагрузку не увеличиваем: держим тот же объём и смотрим, повторяется ли результат.';
}

/**
 * Нагрузку нельзя бесконечно наращивать за успешное выполнение.
 * Иначе вывод простой: чем лучше справляешься, тем сильнее тебя загружают.
 */
export const LOAD_RULE =
  'За успешную неделю нагрузка не увеличивается автоматически. Изменение объёма — только твоё решение.';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
