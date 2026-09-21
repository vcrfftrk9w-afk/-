import type { StuckReason, Task } from './types';
import { currentStep } from './simplify';

export interface StuckOption {
  id: StuckReason;
  label: string;
}

export const STUCK_OPTIONS: StuckOption[] = [
  { id: 'unclear', label: 'Не понимаю, с чего начать' },
  { id: 'fear', label: 'Боюсь сделать плохо' },
  { id: 'distraction', label: 'Меня постоянно отвлекают' },
  { id: 'no_energy', label: 'Сейчас мало сил' },
];

export type StuckActionKind =
  | 'simplify'
  | 'draft'
  | 'park_thought'
  | 'focus'
  | 'smaller'
  | 'postpone'
  | 'rest'
  | 'start';

export interface StuckAction {
  kind: StuckActionKind;
  label: string;
}

export interface StuckScript {
  title: string;
  body: string;
  /** Нужна ли строка для записи отвлекающей мысли. */
  capture?: string;
  actions: StuckAction[];
}

/**
 * Сценарии кнопки «Я завис».
 *
 * Система не объявляет всё ленью и не ставит диагнозов: она спрашивает,
 * что именно мешает, и только потом предлагает конкретную помощь.
 */
export function stuckScript(reason: StuckReason, task: Task | null): StuckScript {
  const step = task ? currentStep(task) : null;

  switch (reason) {
    case 'unclear':
      return {
        title: 'Разберём на части',
        body: step
          ? `Сейчас не нужно делать всё. Нужно сделать только это: ${step.text}. Если и это непонятно — уменьшим ещё раз.`
          : 'Выберем одно маленькое действие, чтобы стало понятно, с чего начинать.',
        actions: [
          { kind: 'simplify', label: 'Уменьшить ещё раз' },
          { kind: 'start', label: 'Понятно, начинаю' },
        ],
      };
    case 'fear':
      return {
        title: 'Сегодня не делаем хорошо',
        body: 'Делаем черновик за пять минут. Его не нужно никому показывать и не нужно сохранять. Плохой вариант можно выбросить, но он снимает блок.',
        actions: [
          { kind: 'draft', label: 'Черновик на 5 минут' },
          { kind: 'simplify', label: 'Сделать ещё меньше' },
        ],
      };
    case 'distraction':
      return {
        title: 'Мысль не потеряется',
        body: 'Запиши отвлекающую мысль сюда. Она сохранится в отдельном списке, и к ней можно вернуться позже. Потом возвращаемся к одному действию.',
        capture: 'Что отвлекает прямо сейчас?',
        actions: [
          { kind: 'park_thought', label: 'Записать и вернуться' },
          { kind: 'focus', label: 'Включить фокус-блок' },
        ],
      };
    case 'no_energy':
    default:
      return {
        title: 'Сегодня можно снизить нагрузку',
        body: 'Нехватка сил — не лень. Выбери честный вариант: маленькая версия задачи, перенос или восстановление. Отдых не нужно заслуживать.',
        actions: [
          { kind: 'smaller', label: 'Маленькая версия' },
          { kind: 'postpone', label: 'Перенести с причиной' },
          { kind: 'rest', label: 'Сегодня восстановление' },
        ],
      };
  }
}

/**
 * Помощь с препятствием вместо мотивационных лозунгов.
 * Разговор ограничен: после короткого выбора приложение предлагает начать,
 * а не генерировать десятую идеальную стратегию.
 */
export interface BlockerBranch {
  id: string;
  question: string;
  options: Array<{ id: string; label: string; help: string; action: StuckActionKind }>;
}

export const CLIENT_SEARCH_BRANCH: BlockerBranch = {
  id: 'find_clients',
  question: 'Что именно стопорит?',
  options: [
    {
      id: 'where',
      label: 'Непонятно, где искать',
      help: 'Выбери один канал и работай только в нём: площадка заказов, профильный чат или знакомые из профессии. Один канал вместо пяти.',
      action: 'simplify',
    },
    {
      id: 'fear',
      label: 'Страшно писать',
      help: 'Возьми короткий шаблон: кто ты, что делаешь, чем можешь помочь именно этому человеку, один вопрос в конце. Отправляем одному адресату.',
      action: 'draft',
    },
    {
      id: 'too_big',
      label: 'Слишком большая задача',
      help: 'Сегодня — только найти одного потенциального клиента и записать его. Отправка сообщений будет отдельным действием.',
      action: 'smaller',
    },
    {
      id: 'no_energy',
      label: 'Нет сил',
      help: 'Сложную часть переносим. Сейчас — подготовительное действие на 2 минуты: открыть список и добавить туда одну строку.',
      action: 'postpone',
    },
  ],
};
