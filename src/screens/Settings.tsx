import { useRef, useState } from 'react';
import { Button, Field, Notice, Option, Sheet, Switch } from '../components/ui';
import { clearState, exportState, parseImported } from '../lib/storage';
import type { FeatureFlags, Mode, Strictness } from '../domain/types';
import { useAppState, useDispatch } from '../store/StoreContext';

const FEATURE_LABELS: Array<{ key: keyof FeatureFlags; label: string; hint: string }> = [
  { key: 'singleTask', label: 'Одна задача на экране', hint: 'Остальной план не показывается на главном экране' },
  { key: 'visualTimer', label: 'Наглядное время', hint: 'Кольцо таймера, а не только цифры' },
  { key: 'softLanding', label: 'Предупреждение перед остановкой', hint: 'За три минуты до конца блока' },
  { key: 'switchHelp', label: 'Помощь с переключением', hint: 'Подсказка «с чего продолжить» после каждого блока' },
  { key: 'fewOptions', label: 'Меньше настроек перед стартом', hint: 'Короткий путь до кнопки «Начать»' },
  { key: 'gamification', label: 'Оформление и город', hint: 'Можно полностью отключить' },
];

export function Settings({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [confirmReset, setConfirmReset] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = state.profile;

  function download() {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `next-step-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildShare(): string {
    const done = state.tasks.filter((t) => t.status === 'done').length;
    const outcomes = state.money.outcomes.length;
    const goal = state.goal?.title ?? 'цель не выбрана';
    // Партнёр видит только то, чем человек решил поделиться. Никаких сумм и диагнозов.
    return `Моя цель: ${goal}. За всё время: завершённых действий — ${done}, внешних шагов — ${outcomes}.`;
  }

  return (
    <Sheet title="Настройки" subtitle="Строгость — по твоему выбору. Данные остаются на этом устройстве." onClose={onClose}>
      {profile ? (
        <>
          <h3>Режим</h3>
          <div className="col">
            <Option
              label="Обычный"
              hint="План на день, приоритеты, привычки, недельный разбор"
              on={profile.mode === 'normal'}
              onClick={() => dispatch({ type: 'profile/mode', mode: 'normal' as Mode })}
            />
            <Option
              label="Адаптированный под трудности с вниманием"
              hint="Одна задача на экране, короткий первый шаг, наглядное время, мягкий выход из блока"
              on={profile.mode === 'adhd'}
              onClick={() => dispatch({ type: 'profile/mode', mode: 'adhd' as Mode })}
            />
          </div>
          <Notice>
            Диагноз не нужен, чтобы пользоваться удобными инструментами. И наоборот: не всем людям с СДВГ подходят
            одинаковые механики — поэтому настройки включаются по отдельности.
          </Notice>

          <div style={{ height: 14 }} />
          <h3>Отдельные настройки</h3>
          {FEATURE_LABELS.map((f) => (
            <Switch
              key={f.key}
              label={f.label}
              hint={f.hint}
              checked={profile.features[f.key]}
              onChange={(v) => dispatch({ type: 'profile/feature', key: f.key, value: v })}
            />
          ))}

          <div style={{ height: 14 }} />
          <h3>Уровень контракта</h3>
          <div className="col">
            {(['soft', 'structured', 'strict'] as Strictness[]).map((s) => (
              <Option
                key={s}
                label={s === 'soft' ? 'Мягкий' : s === 'structured' ? 'Собранный' : 'Строгий'}
                on={profile.strictness === s}
                onClick={() => dispatch({ type: 'profile/strictness', strictness: s })}
              />
            ))}
          </div>

          <div style={{ height: 14 }} />
          <Field label="Реально свободное время в будний день">
            <select
              className="input"
              value={profile.dailyMinutes}
              onChange={(e) => dispatch({ type: 'profile/dailyMinutes', minutes: Number(e.target.value) })}
            >
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} минут
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}

      <h3>Оформление</h3>
      <div className="row wrap">
        {(['system', 'dark', 'light'] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={state.settings.theme === t ? 'primary' : 'default'}
            onClick={() => dispatch({ type: 'settings/update', patch: { theme: t } })}
          >
            {t === 'system' ? 'Как в системе' : t === 'dark' ? 'Тёмная' : 'Светлая'}
          </Button>
        ))}
      </div>

      <div style={{ height: 14 }} />
      <h3>Приватность</h3>
      <Switch
        label="Отправка содержимого задач внешнему ИИ"
        hint="Выключено. В этой версии подсказки работают локально, на устройстве, и ничего не уходит наружу."
        checked={state.settings.externalAI}
        onChange={(v) => dispatch({ type: 'settings/update', patch: { externalAI: v } })}
      />
      <Notice>
        Данные о финансах и личных трудностях чувствительные. Здесь нет рекламы, нет предложений на основе долгов и
        нет передачи данных третьим сторонам. Экспорт и удаление доступны в любой момент.
      </Notice>

      <div style={{ height: 12 }} />
      <h3>Партнёр по ответственности</h3>
      <Field label="Имя партнёра" hint="Партнёр видит только то, чем ты решил поделиться. Суммы и причины переносов не передаются.">
        <input
          className="input"
          value={state.settings.partnerName ?? ''}
          onChange={(e) => dispatch({ type: 'settings/update', patch: { partnerName: e.target.value } })}
        />
      </Field>
      <Button size="sm" onClick={() => setShareText(buildShare())}>
        Показать, чем поделюсь
      </Button>
      {shareText ? (
        <div className="notice" style={{ marginTop: 10 }}>
          {shareText}
          <div style={{ height: 8 }} />
          <Button size="sm" onClick={() => navigator.clipboard?.writeText(shareText)}>
            Скопировать
          </Button>
        </div>
      ) : null}

      <div style={{ height: 14 }} />
      <h3>Данные</h3>
      <div className="row wrap">
        <Button size="sm" onClick={download}>
          Экспорт
        </Button>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          Импорт
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const parsed = parseImported(await file.text());
            if (parsed) dispatch({ type: 'state/import', state: parsed });
          }}
        />
        <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)}>
          Удалить всё
        </Button>
      </div>
      {confirmReset ? (
        <div className="notice" style={{ marginTop: 10 }}>
          Удалить все данные без возможности восстановить?
          <div className="row" style={{ marginTop: 8 }}>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                clearState();
                dispatch({ type: 'state/reset' });
                onClose();
              }}
            >
              Да, удалить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      <div style={{ height: 14 }} />
      <Notice>
        Приложение не лечит СДВГ и не заменяет помощь специалиста. Базовые задачи, упрощение, таймер и настройки
        доступности бесплатны — платить за возможность перестать чувствовать вину здесь не нужно.
      </Notice>
    </Sheet>
  );
}
