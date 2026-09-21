import { useMemo, useState } from 'react';
import { Button, Card, Field, Notice, Option, Progress } from '../components/ui';
import { HABIT_SEEDS, TRACKS } from '../domain/templates';
import type { TrackTemplate } from '../domain/templates';
import type { Habit, LifeContext, MainObstacle, Mode, Strictness } from '../domain/types';
import { useDispatch } from '../store/StoreContext';
import { makeProfile } from '../store/state';
import { id } from '../lib/id';

const CONTEXTS: Array<{ id: LifeContext; label: string; hint: string }> = [
  { id: 'study', label: 'Учусь', hint: 'Учёба занимает основное время' },
  { id: 'job', label: 'Работаю', hint: 'Есть работа, хочу двигаться дальше' },
  { id: 'job_search', label: 'Ищу работу', hint: 'Сейчас главное — найти место' },
  { id: 'own_business', label: 'Своё дело', hint: 'Уже есть заказы или клиенты' },
];

const OBSTACLES: Array<{ id: MainObstacle; label: string; hint: string }> = [
  { id: 'start', label: 'Не начинаю', hint: 'Знаю, что делать, но не запускаюсь' },
  { id: 'distraction', label: 'Отвлекаюсь', hint: 'Начинаю и теряю нить' },
  { id: 'forget', label: 'Забываю', hint: 'Задача исчезает из головы' },
  { id: 'overload', label: 'Беру слишком много', hint: 'Планирую больше, чем выдерживаю' },
];

const STRICTNESS: Array<{ id: Strictness; label: string; hint: string }> = [
  { id: 'soft', label: 'Мягкий', hint: 'Одно напоминание и предложение удобного времени' },
  { id: 'structured', label: 'Собранный', hint: 'Время старта, повторный запрос, фокус-режим, итог вечером' },
  { id: 'strict', label: 'Строгий', hint: 'Заранее выбранные ограничения и осознанное подтверждение переноса' },
];

const TIME_OPTIONS = [15, 30, 45, 60, 90];

function suggestTrackIds(context: LifeContext): string[] {
  switch (context) {
    case 'job':
      return ['promotion', 'skill', 'freelance', 'validate', 'grow_existing'];
    case 'job_search':
      return ['promotion', 'skill', 'freelance', 'validate', 'grow_existing'];
    case 'study':
      return ['skill', 'freelance', 'promotion', 'validate', 'grow_existing'];
    case 'own_business':
    default:
      return ['grow_existing', 'validate', 'freelance', 'promotion', 'skill'];
  }
}

export function Onboarding() {
  const dispatch = useDispatch();
  const [step, setStep] = useState(0);
  const [context, setContext] = useState<LifeContext>('job');
  const [obstacle, setObstacle] = useState<MainObstacle>('start');
  const [track, setTrack] = useState<TrackTemplate | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCheckpoint, setGoalCheckpoint] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [hasDebts, setHasDebts] = useState(false);
  const [strictness, setStrictness] = useState<Strictness>('structured');
  const [mode, setMode] = useState<Mode>('normal');
  const [habitIdx, setHabitIdx] = useState<number[]>([]);

  const orderedTracks = useMemo(() => {
    const order = suggestTrackIds(context);
    return [...TRACKS].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [context]);

  const steps = 7;

  function chooseTrack(t: TrackTemplate) {
    setTrack(t);
    setGoalTitle(t.goalTitle);
    setGoalCheckpoint(t.goalCheckpoint);
  }

  function toggleHabit(index: number) {
    setHabitIdx((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 2) return prev; // максимум две поддерживающие привычки
      return [...prev, index];
    });
  }

  function finish() {
    const habits: Habit[] = habitIdx.map((i) => {
      const seed = HABIT_SEEDS[i];
      return { ...seed, id: id('habit'), createdAt: new Date().toISOString(), active: true };
    });
    dispatch({
      type: 'onboarding/complete',
      profile: makeProfile({ context, obstacle, dailyMinutes, hasDebts, mode, strictness }),
      track: track ?? undefined,
      goalTitle: goalTitle.trim() || (track?.goalTitle ?? 'Моя цель на три месяца'),
      goalCheckpoint: goalCheckpoint.trim() || (track?.goalCheckpoint ?? 'Как пойму, что цель достигнута'),
      habits,
    });
  }

  return (
    <div className="screen" style={{ paddingTop: 24 }}>
      <Progress value={step / steps} />

      {step === 0 && (
        <Card>
          <h1>Следующий шаг</h1>
          <p>
            Это не трекер галочек. Приложение не спрашивает «что хочешь поделать» — оно показывает одно конкретное
            действие, которое приближает тебя к цели прямо сейчас.
          </p>
          <p className="muted small">
            Разговор короткий: шесть вопросов. Анкеты на сорок минут не будет.
          </p>
          <Notice>
            Приложение не лечит СДВГ и не заменяет помощь специалиста. Диагноз указывать не нужно: удобные инструменты
            включаются по отдельности.
          </Notice>
          <div style={{ height: 12 }} />
          <Button variant="primary" block onClick={() => setStep(1)}>
            Начать
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h2>Чем ты занят сейчас?</h2>
          <div className="col">
            {CONTEXTS.map((c) => (
              <Option key={c.id} label={c.label} hint={c.hint} on={context === c.id} onClick={() => setContext(c.id)} />
            ))}
          </div>
          <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} />
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h2>Что мешает больше всего?</h2>
          <p className="muted small">Ответ настроит помощь, а не поставит диагноз.</p>
          <div className="col">
            {OBSTACLES.map((o) => (
              <Option key={o.id} label={o.label} hint={o.hint} on={obstacle === o.id} onClick={() => setObstacle(o.id)} />
            ))}
          </div>
          <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </Card>
      )}

      {step === 3 && (
        <Card>
          <h2>Главная цель на ближайшие три месяца</h2>
          <p className="muted small">
            Вместо «хочу стать богатым» — ближайшая проверяемая цель. Выбери путь, формулировку можно поправить.
          </p>
          <div className="col">
            {orderedTracks.map((t) => (
              <Option key={t.id} label={t.title} hint={t.fit} on={track?.id === t.id} onClick={() => chooseTrack(t)} />
            ))}
          </div>
          {track ? (
            <div style={{ marginTop: 16 }}>
              <Field label="Цель" hint="Одна большая цель за раз. Остальные идеи останутся в отдельном списке.">
                <textarea className="input" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
              </Field>
              <Field label="Как пойму, что цель достигнута" hint="Проверяемый признак, а не ощущение.">
                <textarea className="input" value={goalCheckpoint} onChange={(e) => setGoalCheckpoint(e.target.value)} />
              </Field>
            </div>
          ) : null}
          <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!track} />
        </Card>
      )}

      {step === 4 && (
        <Card>
          <h2>Сколько свободного времени есть в действительности?</h2>
          <p className="muted small">Не идеальный план, а то, что обычно остаётся в будний день.</p>
          <div className="row wrap">
            {TIME_OPTIONS.map((m) => (
              <Option key={m} label={`${m} минут`} on={dailyMinutes === m} onClick={() => setDailyMinutes(m)} />
            ))}
          </div>
          <div style={{ height: 16 }} />
          <h3>Есть ли финансовые обязательства?</h3>
          <div className="row wrap">
            <Option label="Да, есть долги или кредиты" on={hasDebts} onClick={() => setHasDebts(true)} />
            <Option label="Нет" on={!hasDebts} onClick={() => setHasDebts(false)} />
          </div>
          <Nav onBack={() => setStep(3)} onNext={() => setStep(5)} />
        </Card>
      )}

      {step === 5 && (
        <Card>
          <h2>Нужны мягкие напоминания или строгая структура?</h2>
          <div className="col">
            {STRICTNESS.map((s) => (
              <Option key={s.id} label={s.label} hint={s.hint} on={strictness === s.id} onClick={() => setStrictness(s.id)} />
            ))}
          </div>
          <div className="divider" style={{ margin: '16px 0' }} />
          <h3>Режим работы приложения</h3>
          <div className="col">
            <Option
              label="Обычный режим"
              hint="План на день, несколько приоритетов, привычки, недельный разбор"
              on={mode === 'normal'}
              onClick={() => setMode('normal')}
            />
            <Option
              label="Режим, адаптированный под трудности с вниманием"
              hint="Одна задача на экране, первый шаг 1–5 минут, наглядное время, помощь с переключением"
              on={mode === 'adhd'}
              onClick={() => setMode('adhd')}
            />
          </div>
          <Notice>Каждую настройку можно включить отдельно позже. Диагноз не нужен, чтобы пользоваться удобными инструментами.</Notice>
          <Nav onBack={() => setStep(4)} onNext={() => setStep(6)} />
        </Card>
      )}

      {step === 6 && (
        <Card>
          <h2>Две поддерживающие привычки</h2>
          <p className="muted small">
            Больше двух не берём: иначе саморазвитие само превращается в источник перегруза. Можно выбрать одну или
            пропустить.
          </p>
          <div className="col">
            {HABIT_SEEDS.map((h, i) => (
              <Option
                key={h.title}
                label={`${h.title} — ${h.anchor.toLowerCase()}`}
                hint={`Минимум: ${h.minVersion.toLowerCase()} · Обычная: ${h.normalVersion.toLowerCase()}`}
                on={habitIdx.includes(i)}
                onClick={() => toggleHabit(i)}
              />
            ))}
          </div>
          <div style={{ height: 14 }} />
          <Button variant="primary" block onClick={finish}>
            Готово — показать следующий шаг
          </Button>
          <div style={{ height: 8 }} />
          <Button variant="ghost" block onClick={() => setStep(5)}>
            Назад
          </Button>
        </Card>
      )}
    </div>
  );
}

function Nav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="row" style={{ marginTop: 18 }}>
      <Button variant="ghost" onClick={onBack}>
        Назад
      </Button>
      <Button variant="primary" onClick={onNext} disabled={nextDisabled} style={{ flex: 1 }}>
        Дальше
      </Button>
    </div>
  );
}
