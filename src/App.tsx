import { useEffect, useState } from 'react';
import { Button } from './components/ui';
import { Focus } from './screens/Focus';
import type { FocusConfig } from './screens/Focus';
import { Money } from './screens/Money';
import { Now } from './screens/Now';
import { Onboarding } from './screens/Onboarding';
import { Path } from './screens/Path';
import { Review } from './screens/Review';
import { Settings } from './screens/Settings';
import { useAppState } from './store/StoreContext';

type Tab = 'now' | 'path' | 'money' | 'review';

const TABS: Array<{ id: Tab; label: string; glyph: string }> = [
  { id: 'now', label: 'Сейчас', glyph: '→' },
  { id: 'path', label: 'Путь', glyph: '◈' },
  { id: 'money', label: 'Деньги', glyph: '₽' },
  { id: 'review', label: 'Разбор', glyph: '↺' },
];

export function App() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('now');
  const [focus, setFocus] = useState<FocusConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const theme = state.settings.theme;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [state.settings.theme]);

  if (!state.profile) {
    return (
      <div className="app">
        <Onboarding />
      </div>
    );
  }

  if (focus) {
    return <Focus config={focus} onClose={() => setFocus(null)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="title">Следующий шаг</div>
        <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
          Настройки
        </Button>
      </header>

      {tab === 'now' && <Now onFocus={setFocus} />}
      {tab === 'path' && <Path />}
      {tab === 'money' && <Money />}
      {tab === 'review' && <Review />}

      <nav className="tabbar" aria-label="Основные разделы">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            <span className="glyph" aria-hidden="true">
              {t.glyph}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {settingsOpen ? <Settings onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
