import { useState } from 'react';
import { Button, Field, Notice, Option, Sheet } from './ui';
import { CLIENT_SEARCH_BRANCH, STUCK_OPTIONS, stuckScript } from '../domain/stuck';
import type { StuckActionKind } from '../domain/stuck';
import type { PostponeReason, StuckReason, Task } from '../domain/types';
import { addDays, isoDate } from '../lib/date';

export interface StuckHandlers {
  onSimplify: () => void;
  onDraft: () => void;
  onFocus: () => void;
  onPark: (text: string) => void;
  onPostpone: () => void;
  onRest: () => void;
  onStart: () => void;
}

export function StuckSheet({ task, onClose, onReason, handlers }: {
  task: Task | null;
  onClose: () => void;
  onReason: (reason: StuckReason) => void;
  handlers: StuckHandlers;
}) {
  const [reason, setReason] = useState<StuckReason | null>(null);
  const [capture, setCapture] = useState('');
  const script = reason ? stuckScript(reason, task) : null;

  function run(kind: StuckActionKind) {
    switch (kind) {
      case 'simplify':
      case 'smaller':
        handlers.onSimplify();
        break;
      case 'draft':
        handlers.onDraft();
        break;
      case 'focus':
        handlers.onFocus();
        break;
      case 'park_thought':
        if (capture.trim()) handlers.onPark(capture.trim());
        break;
      case 'postpone':
        handlers.onPostpone();
        return;
      case 'rest':
        handlers.onRest();
        break;
      case 'start':
        handlers.onStart();
        break;
    }
    onClose();
  }

  return (
    <Sheet
      title="Я завис"
      subtitle="Система не объявляет всё ленью. Скажи, что именно мешает — помощь будет разной."
      onClose={onClose}
    >
      {!script ? (
        <div className="col">
          {STUCK_OPTIONS.map((o) => (
            <Option
              key={o.id}
              label={o.label}
              onClick={() => {
                setReason(o.id);
                onReason(o.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div>
          <h3>{script.title}</h3>
          <p className="small">{script.body}</p>
          {script.capture ? (
            <Field label={script.capture}>
              <input className="input" value={capture} onChange={(e) => setCapture(e.target.value)} autoFocus />
            </Field>
          ) : null}
          <div className="col">
            {script.actions.map((a) => (
              <Button key={a.kind} variant={a.kind === 'start' ? 'primary' : 'default'} block onClick={() => run(a.kind)}>
                {a.label}
              </Button>
            ))}
          </div>
          <div style={{ height: 10 }} />
          <Button variant="ghost" block onClick={() => setReason(null)}>
            Другая причина
          </Button>
        </div>
      )}
    </Sheet>
  );
}

const POSTPONE_REASONS: Array<{ id: PostponeReason; label: string }> = [
  { id: 'no_time', label: 'Не хватило времени' },
  { id: 'too_big', label: 'Слишком большая задача' },
  { id: 'unclear', label: 'Непонятно, что делать' },
  { id: 'no_energy', label: 'Мало сил' },
  { id: 'not_important', label: 'Оказалось неважным' },
  { id: 'other', label: 'Другое' },
];

export function PostponeSheet({ task, strict, onClose, onConfirm }: {
  task: Task;
  strict: boolean;
  onClose: () => void;
  onConfirm: (reason: PostponeReason, until?: string) => void;
}) {
  const [reason, setReason] = useState<PostponeReason | null>(null);
  const [until, setUntil] = useState<string | undefined>(addDays(isoDate(), 1));
  const [confirmed, setConfirmed] = useState(!strict);

  return (
    <Sheet
      title="Перенести задачу"
      subtitle="Перенос — не провал. Но у него есть причина, и она пригодится в недельном разборе."
      onClose={onClose}
    >
      <p className="small muted">{task.title}</p>
      <div className="col">
        {POSTPONE_REASONS.map((r) => (
          <Option key={r.id} label={r.label} on={reason === r.id} onClick={() => setReason(r.id)} />
        ))}
      </div>
      <div style={{ height: 14 }} />
      <Field label="Когда вернёмся?" hint="Можно не выбирать дату: тогда задача попадёт в переоценку, а не в долг на завтра.">
        <div className="row wrap">
          <Button size="sm" variant={until === addDays(isoDate(), 1) ? 'primary' : 'default'} onClick={() => setUntil(addDays(isoDate(), 1))}>
            Завтра
          </Button>
          <Button size="sm" variant={until === addDays(isoDate(), 7) ? 'primary' : 'default'} onClick={() => setUntil(addDays(isoDate(), 7))}>
            Через неделю
          </Button>
          <Button size="sm" variant={until === undefined ? 'primary' : 'default'} onClick={() => setUntil(undefined)}>
            Без даты — в переоценку
          </Button>
        </div>
      </Field>

      {strict && !confirmed ? (
        <>
          <Notice>
            Строгий уровень: перенос требует осознанного подтверждения. Это твоё собственное решение, принятое заранее,
            а не наказание.
          </Notice>
          <div style={{ height: 10 }} />
          <Button block onClick={() => setConfirmed(true)}>
            Да, я сознательно переношу
          </Button>
        </>
      ) : null}

      <div style={{ height: 10 }} />
      <Button
        variant="primary"
        block
        disabled={!reason || !confirmed}
        onClick={() => reason && onConfirm(reason, until)}
      >
        Перенести
      </Button>
      <div style={{ height: 8 }} />
      <p className="tiny muted">
        Если задача переносится третий раз — приложение предложит не дисциплину, а разбор конкретного препятствия.
      </p>
    </Sheet>
  );
}

/**
 * Помощь с конкретным препятствием вместо «верь в себя».
 * Разговор ограничен: после выбора предлагается начать первый шаг.
 */
export function BlockerSheet({ task, onClose, onSimplify, onStart }: {
  task: Task;
  onClose: () => void;
  onSimplify: () => void;
  onStart: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const option = CLIENT_SEARCH_BRANCH.options.find((o) => o.id === picked) ?? null;

  return (
    <Sheet title="Мне что-то мешает" subtitle={task.title} onClose={onClose}>
      {!option ? (
        <>
          <p className="small">{CLIENT_SEARCH_BRANCH.question}</p>
          <div className="col">
            {CLIENT_SEARCH_BRANCH.options.map((o) => (
              <Option key={o.id} label={o.label} onClick={() => setPicked(o.id)} />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="small">{option.help}</p>
          <Notice>План достаточно хороший. Дальше — не десятая идеальная стратегия, а первый шаг.</Notice>
          <div style={{ height: 12 }} />
          <div className="col">
            <Button
              variant="primary"
              block
              onClick={() => {
                if (option.action === 'simplify' || option.action === 'smaller' || option.action === 'postpone') onSimplify();
                onStart();
                onClose();
              }}
            >
              Начнём первый шаг
            </Button>
            <Button variant="ghost" block onClick={() => setPicked(null)}>
              Другая причина
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
