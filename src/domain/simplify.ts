import type { LadderStep, Task } from './types';

/**
 * Лестница упрощения.
 *
 * «Сделать проще» не читает лекцию о дисциплине, а уменьшает порог входа:
 * «Обновить резюме» → «Открыть файл» → «Найти нужный раздел» → «Написать один черновой пункт».
 *
 * Если у задачи есть своя лестница из шаблона — берём её.
 * Иначе строим общую: задача целиком → первый шаг → открыть инструмент → две минуты черновика.
 */
export function buildLadder(task: Task): LadderStep[] {
  if (task.ladder && task.ladder.length > 0) return task.ladder;

  const full: LadderStep = { text: task.title, minutes: task.estimateMin };
  const half: LadderStep = {
    text: `Сделать половину: ${lowerFirst(task.title)}`,
    minutes: Math.max(5, Math.round(task.estimateMin / 2)),
  };
  const first: LadderStep = { text: task.firstStep, minutes: task.firstStepMin };
  const draft: LadderStep = {
    text: 'Две минуты чернового варианта. Его не нужно никому показывать',
    minutes: 2,
  };
  const entry: LadderStep = {
    text: 'Просто открыть то, где это делается. Дальше можно закрыть',
    minutes: 1,
  };

  const steps = [full];
  if (task.estimateMin >= 20) steps.push(half);
  steps.push(first, draft, entry);
  return dedupe(steps);
}

/** Текущая ступень: что именно предлагаем прямо сейчас. */
export function currentStep(task: Task): LadderStep {
  const ladder = buildLadder(task);
  const index = Math.min(task.simplifyLevel, ladder.length - 1);
  return ladder[index];
}

export function canSimplify(task: Task): boolean {
  return task.simplifyLevel < buildLadder(task).length - 1;
}

/** Насколько глубоко упростили — чтобы честно показывать это в разборе. */
export function simplifyDepth(task: Task): number {
  return task.simplifyLevel;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function dedupe(steps: LadderStep[]): LadderStep[] {
  const seen = new Set<string>();
  return steps.filter((s) => {
    const key = s.text.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
