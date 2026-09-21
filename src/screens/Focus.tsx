import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Notice } from '../components/ui';
import { TimerRing } from '../components/TimerRing';
import { formatMinutes } from '../lib/date';
import { id } from '../lib/id';
import type { FocusSession } from '../domain/types';
import { useAppState, useDispatch } from '../store/StoreContext';

export interface FocusConfig {
  taskId?: string;
  intent: string;
  minutes: number;
  companion: 'solo' | 'auto' | 'partner';
  /** Что человек сам согласился ограничить на это время. */
  limited: string[];
}

export function Focus({ config, onClose }: { config: FocusConfig; onClose: (completed: boolean) => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const features = state.profile?.features;
  const total = config.minutes * 60;
  const [left, setLeft] = useState(total);
  const [phase, setPhase] = useState<'running' | 'wrap'>('running');
  const [result, setResult] = useState('');
  const [hint, setHint] = useState('');
  const [parked, setParked] = useState('');
  const sessionId = useRef<string>(id('fs'));
  const startedRef = useRef(false);

  const session: FocusSession = useMemo(
    () => ({
      id: sessionId.current,
      taskId: config.taskId,
      intent: config.intent,
      plannedMin: config.minutes,
      startedAt: new Date().toISOString(),
      companion: config.companion,
      interrupted: false,
    }),
    [config],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    dispatch({ type: 'session/start', session });
    if (config.taskId) dispatch({ type: 'task/start', taskId: config.taskId });
  }, [dispatch, session, config.taskId]);

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          setPhase('wrap');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Тяжело бывает не только начать дело, но и вовремя из него выйти.
  const softLanding = (features?.softLanding ?? true) && phase === 'running' && left <= 180 && left > 0;

  function finish(interrupted: boolean) {
    dispatch({
      type: 'session/end',
      sessionId: sessionId.current,
      result: result.trim() || undefined,
      resumeHint: hint.trim() || undefined,
      interrupted,
    });
    onClose(!interrupted);
  }

  if (phase === 'wrap') {
    return (
      <div className="focus-screen">
        <h2>Блок закончился</h2>
        <p className="muted small">Коротко зафиксируем результат. Догонять упущенное не нужно.</p>
        <div style={{ width: '100%', maxWidth: 460, textAlign: 'left' }}>
          <Field label="Что получилось?" hint="Одной строки достаточно. Даже «открыл файл» — это результат.">
            <input className="input" value={result} onChange={(e) => setResult(e.target.value)} />
          </Field>
          <Field label="С чего продолжить в следующий раз?" hint="Подсказка себе, чтобы следующий старт был дешевле.">
            <input className="input" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Например: дописать второй пункт" />
          </Field>
        </div>
        <div className="row" style={{ width: '100%', maxWidth: 460 }}>
          <Button variant="primary" block onClick={() => finish(false)}>
            Сохранить
          </Button>
        </div>
        {config.taskId ? (
          <Button
            variant="ghost"
            onClick={() => {
              dispatch({ type: 'task/done', taskId: config.taskId as string, resumeHint: hint.trim() || undefined });
              finish(false);
            }}
          >
            Задача сделана целиком
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="focus-screen">
      <div className="badge">{config.companion === 'solo' ? 'Одиночный блок' : config.companion === 'auto' ? 'Автоматическое сопровождение' : 'Работаем рядом'}</div>
      <div className="intent">{config.intent}</div>
      <TimerRing
        totalSeconds={total}
        leftSeconds={left}
        visual={features?.visualTimer ?? true}
        label={`Запланировано ${formatMinutes(config.minutes)}`}
      />

      {softLanding ? (
        <div className="warning" style={{ maxWidth: 460 }}>
          Через три минуты остановка. Закончи текущую мысль и оставь себе подсказку, с чего продолжить.
        </div>
      ) : null}

      {config.limited.length > 0 ? (
        <Notice>
          На это время ты сам ограничил: {config.limited.join(', ')}. Веб-приложение не может блокировать другие
          программы — оно показывает договорённость и держит её на виду. Звонки, банки, медицинские сервисы и важные
          контакты не ограничиваются никогда.
        </Notice>
      ) : null}

      <div style={{ width: '100%', maxWidth: 460 }}>
        <Field label="Отвлекающая мысль" hint="Она не пропадёт: попадёт в отдельный список и не потянет тебя из задачи.">
          <div className="row">
            <input className="input" value={parked} onChange={(e) => setParked(e.target.value)} placeholder="Записать и вернуться" />
            <Button
              size="sm"
              onClick={() => {
                if (!parked.trim()) return;
                dispatch({ type: 'parking/add', text: parked.trim() });
                setParked('');
              }}
            >
              В список
            </Button>
          </div>
        </Field>
      </div>

      <div className="row wrap" style={{ justifyContent: 'center' }}>
        <Button onClick={() => setPhase('wrap')}>Закончить сейчас</Button>
        <Button variant="ghost" onClick={() => finish(true)}>
          Аварийный выход
        </Button>
      </div>
      <p className="tiny muted" style={{ maxWidth: 420 }}>
        Выход доступен всегда и без унижений. Никаких списаний и штрафов за прерванный блок.
      </p>
    </div>
  );
}
