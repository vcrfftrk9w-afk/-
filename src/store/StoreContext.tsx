import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { loadState, saveState } from '../lib/storage';
import { isoDate } from '../lib/date';
import type { AppState } from '../domain/types';
import type { Action } from './actions';
import { reducer } from './reducer';
import { createInitialState } from './state';

interface Store {
  state: AppState;
  dispatch: (action: Action) => void;
}

const StoreContext = createContext<Store | null>(null);

function init(): AppState {
  const saved = loadState();
  if (!saved) return createInitialState();
  const today = isoDate();
  if (saved.day.date !== today) {
    // Новый день начинается с чистого листа, а не с долгов вчерашнего.
    return { ...saved, day: { date: today, capacity: 'normal', windowMin: saved.day.windowMin } };
  }
  return saved;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore вызван вне StoreProvider');
  return ctx;
}

export function useAppState(): AppState {
  return useStore().state;
}

export function useDispatch(): (action: Action) => void {
  return useStore().dispatch;
}
