import type { AppState } from '../domain/types';

const KEY = 'next-step/state/v1';

/**
 * Всё хранится локально в браузере. Ничего не отправляется на сервер:
 * данные о финансах и личных трудностях чувствительные.
 */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Приватный режим или переполненное хранилище — работаем дальше без записи.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ничего не делаем */
  }
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseImported(text: string): AppState | null {
  try {
    const parsed = JSON.parse(text) as AppState;
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
