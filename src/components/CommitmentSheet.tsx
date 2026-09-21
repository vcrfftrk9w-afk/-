import { useState } from 'react';
import { Button, Field, Notice, Option, Sheet } from './ui';
import { addDays, isoDate } from '../lib/date';
import { id } from '../lib/id';
import type { Commitment, Strictness, Task } from '../domain/types';

const LIMIT_OPTIONS = ['короткие видео', 'игры', 'соцсети', 'новости', 'стриминг'];

const LEVEL_TEXT: Record<Strictness, string> = {
  soft: 'Одно напоминание и предложение удобного времени. Если не начал — задача упрощается, а не наказывает.',
  structured: 'Конкретное время старта, повторный запрос, выбор причины переноса, фокус-режим и короткий итог вечером.',
  strict:
    'Ограничения начинаются в согласованное время и снимаются в конце интервала. Перенос требует осознанного подтверждения.',
};

/**
 * Добровольный контракт с собой: решение принимается заранее,
 * чтобы в момент старта не договариваться с собой заново.
 */
export function CommitmentSheet({ task, defaultStrictness, onClose, onCreate }: {
  task: Task | null;
  defaultStrictness: Strictness;
  onClose: () => void;
  onCreate: (c: Commitment) => void;
}) {
  const [date, setDate] = useState(isoDate());
  const [start, setStart] = useState('19:00');
  const [duration, setDuration] = useState(25);
  const [level, setLevel] = useState<Strictness>(defaultStrictness);
  const [limited, setLimited] = useState<string[]>([]);
  const [title, setTitle] = useState(task?.title ?? '');

  function toggleLimit(x: string) {
    setLimited((prev) => (prev.includes(x) ? prev.filter((i) => i !== x) : [...prev, x]));
  }

  return (
    <Sheet
      title="Договориться о времени"
      subtitle="Решение принимается сейчас, спокойно. В момент старта уже не надо уговаривать себя."
      onClose={onClose}
    >
      <Field label="Что делаем">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: портфолио" />
      </Field>
      <div className="row wrap">
        <Button size="sm" variant={date === isoDate() ? 'primary' : 'default'} onClick={() => setDate(isoDate())}>
          Сегодня
        </Button>
        <Button
          size="sm"
          variant={date === addDays(isoDate(), 1) ? 'primary' : 'default'}
          onClick={() => setDate(addDays(isoDate(), 1))}
        >
          Завтра
        </Button>
      </div>
      <div style={{ height: 12 }} />
      <div className="row">
        <Field label="Начало">
          <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Длительность">
          <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            <option value={15}>15 минут</option>
            <option value={25}>25 минут</option>
            <option value={50}>50 минут</option>
          </select>
        </Field>
      </div>

      <h3>Уровень строгости</h3>
      <div className="col">
        {(['soft', 'structured', 'strict'] as Strictness[]).map((s) => (
          <Option
            key={s}
            label={s === 'soft' ? 'Мягкий' : s === 'structured' ? 'Собранный' : 'Строгий'}
            hint={LEVEL_TEXT[s]}
            on={level === s}
            onClick={() => setLevel(s)}
          />
        ))}
      </div>

      {level === 'strict' ? (
        <>
          <div style={{ height: 12 }} />
          <h3>Что ограничиваем на это время</h3>
          <div className="row wrap">
            {LIMIT_OPTIONS.map((x) => (
              <Button key={x} size="sm" variant={limited.includes(x) ? 'primary' : 'default'} onClick={() => toggleLimit(x)}>
                {x}
              </Button>
            ))}
          </div>
          <div style={{ height: 10 }} />
          <Notice>
            Ограничиваются только заранее выбранные отвлечения и только там, где это позволяет система. Звонки, банки,
            медицинские сервисы и важные контакты не блокируются никогда. Аварийный выход доступен всегда, денежных
            штрафов нет.
          </Notice>
        </>
      ) : null}

      <div style={{ height: 14 }} />
      <Button
        variant="primary"
        block
        disabled={!title.trim()}
        onClick={() =>
          onCreate({
            id: id('com'),
            taskId: task?.id,
            title: title.trim(),
            date,
            start,
            durationMin: duration,
            strictness: level,
            limited,
            createdAt: new Date().toISOString(),
            status: 'planned',
          })
        }
      >
        Зафиксировать
      </Button>
    </Sheet>
  );
}
