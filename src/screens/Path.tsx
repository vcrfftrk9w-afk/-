import { useState } from 'react';
import { Button, Card, Field, Notice, Option, Progress, Sheet } from '../components/ui';
import { City } from '../components/City';
import { cityLevel } from '../domain/metrics';
import { firstUnfinishedStageId } from '../domain/engine';
import { canAddHabit, habitStats, MAX_ACTIVE_HABITS } from '../domain/habits';
import { HABIT_SEEDS, TRACKS } from '../domain/templates';
import { addDays, formatMinutes, isoDate } from '../lib/date';
import { id } from '../lib/id';
import type { TaskKind } from '../domain/types';
import { useAppState, useDispatch } from '../store/StoreContext';

export function Path() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [sheet, setSheet] = useState<'task' | 'goal' | 'habit' | 'idea' | null>(null);
  const [stageId, setStageId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [firstStep, setFirstStep] = useState('');
  const [kind, setKind] = useState<TaskKind>('prep');
  const [estimate, setEstimate] = useState(20);
  const [idea, setIdea] = useState('');

  const goal = state.goal;
  const stages = [...state.stages].sort((a, b) => a.order - b.order);
  const currentStageId = firstUnfinishedStageId(state);
  const doneStages = stages.filter((s) => s.doneAt).length;
  const weekStartDate = isoDate();
  const thisWeek = state.tasks.filter(
    (t) => t.status === 'todo' && t.scheduledFor && t.scheduledFor >= weekStartDate && t.scheduledFor <= addDays(weekStartDate, 6),
  );

  if (!goal) {
    return (
      <div className="screen">
        <Card>
          <h2>Цели пока нет</h2>
          <p className="small muted">Выбери путь — из него вырастут этапы и конкретные задания.</p>
          <Button variant="primary" block onClick={() => setSheet('goal')}>
            Выбрать путь
          </Button>
        </Card>
        {sheet === 'goal' ? <GoalSheet onClose={() => setSheet(null)} /> : null}
      </div>
    );
  }

  return (
    <div className="screen">
      <Card accent>
        <div className="muted small">Большая цель · {goal.horizonWeeks} недель</div>
        <h2 style={{ marginTop: 6 }}>{goal.title}</h2>
        <p className="small muted">Проверяемый признак: {goal.checkpoint}</p>
        <Progress value={stages.length ? doneStages / stages.length : 0} />
        <div className="tiny muted" style={{ marginTop: 6 }}>
          Этапов пройдено: {doneStages} из {stages.length}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Button size="sm" variant="ghost" onClick={() => setSheet('goal')}>
            Сменить путь
          </Button>
        </div>
      </Card>

      <Card>
        <h2>Этапы</h2>
        <div className="col">
          {stages.map((stage) => {
            const tasks = state.tasks.filter((t) => t.stageId === stage.id);
            const open = tasks.filter((t) => t.status === 'todo');
            const isCurrent = stage.id === currentStageId;
            return (
              <div key={stage.id} className="stage-line">
                <div className={`stage-dot${stage.doneAt ? ' done' : isCurrent ? ' current' : ''}`} />
                <div style={{ flex: 1 }}>
                  <div className="row between">
                    <strong>{stage.title}</strong>
                    <span className="tiny muted">
                      {tasks.length - open.length}/{tasks.length}
                    </span>
                  </div>
                  {isCurrent || open.length === 0 ? (
                    <div className="list" style={{ marginTop: 8 }}>
                      {tasks.map((t) => (
                        <div key={t.id} className={`list-item${t.status !== 'todo' ? ' done' : ''}`}>
                          <div>
                            <div className="small">{t.title}</div>
                            <div className="tiny muted">
                              первый шаг: {t.firstStep.toLowerCase()} · {formatMinutes(t.estimateMin)}
                              {t.kind === 'reality' ? ' · внешний шаг' : ''}
                            </div>
                          </div>
                          {t.status === 'todo' ? (
                            <div className="col">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => dispatch({ type: 'task/schedule', taskId: t.id, date: isoDate() })}
                              >
                                На сегодня
                              </Button>
                            </div>
                          ) : (
                            <span className="badge">{t.status === 'done' ? 'сделано' : 'убрано'}</span>
                          )}
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setStageId(stage.id);
                          setSheet('task');
                        }}
                      >
                        + задание в этап
                      </Button>
                    </div>
                  ) : (
                    <div className="tiny muted">
                      {open.length} {open.length === 1 ? 'задание' : 'задания'} впереди
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2>Недельный план</h2>
        {thisWeek.length === 0 ? (
          <p className="small muted">
            На эту неделю ничего не назначено. Это не проблема: следующий шаг всё равно найдётся на вкладке «Сейчас».
          </p>
        ) : (
          <div className="list">
            {thisWeek.map((t) => (
              <div key={t.id} className="list-item">
                <div className="small">{t.title}</div>
                <span className="badge">{t.scheduledFor}</span>
              </div>
            ))}
          </div>
        )}
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Нагрузка не растёт автоматически за успешную неделю. Объём меняешь только ты.
        </p>
      </Card>

      <Card>
        <h2>Привычки</h2>
        <p className="tiny muted">
          Одновременно активны максимум {MAX_ACTIVE_HABITS}. Остальное подождёт — иначе саморазвитие само становится
          перегрузом.
        </p>
        <div className="list">
          {state.habits.map((h) => (
            <div key={h.id} className={`list-item${h.active ? '' : ' done'}`}>
              <div>
                <strong>{h.title}</strong>
                <div className="tiny muted">{h.anchor}</div>
                <div className="tiny muted">{habitStats(state, h).phrase}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'habit/toggle', habitId: h.id })}>
                {h.active ? 'Отложить' : 'Вернуть'}
              </Button>
            </div>
          ))}
        </div>
        <div style={{ height: 10 }} />
        <Button size="sm" disabled={!canAddHabit(state)} onClick={() => setSheet('habit')}>
          + привычка
        </Button>
        {!canAddHabit(state) ? (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Уже две активные привычки. Чтобы добавить новую, отложи одну из текущих.
          </p>
        ) : null}
      </Card>

      <Card>
        <h2>Остальные идеи</h2>
        <p className="small muted">
          Всё, что не входит в одну большую цель, живёт здесь и не мешает. Идею можно достать в любой момент.
        </p>
        <div className="row">
          <input className="input" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Записать идею" />
          <Button
            onClick={() => {
              if (!idea.trim()) return;
              dispatch({ type: 'parking/add', text: idea.trim() });
              setIdea('');
            }}
          >
            В список
          </Button>
        </div>
        <div className="list" style={{ marginTop: 10 }}>
          {state.parking.map((p) => (
            <div key={p.id} className="list-item">
              <div className="small">{p.text}</div>
              <div className="row">
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'parking/promote', ideaId: p.id })}>
                  В задачи
                </Button>
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'parking/remove', ideaId: p.id })}>
                  Убрать
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {state.profile?.features.gamification ? (
        <Card flat>
          <h3>Город</h3>
          <City level={cityLevel(state)} />
          <p className="tiny muted">
            Город растёт от завершённых этапов и внешних шагов. За пропуск он не разрушается, случайных платных наград
            и рейтингов здесь нет. Оформление можно отключить в настройках.
          </p>
        </Card>
      ) : null}

      {sheet === 'task' && (
        <Sheet title="Новое задание" subtitle="Конкретное действие, а не «поработать над целью»." onClose={() => setSheet(null)}>
          <Field label="Что сделать">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Первый шаг на 1–5 минут" hint="То, с чего физически начинается задача.">
            <input className="input" value={firstStep} onChange={(e) => setFirstStep(e.target.value)} />
          </Field>
          <Field label="Сколько займёт целиком">
            <select className="input" value={estimate} onChange={(e) => setEstimate(Number(e.target.value))}>
              {[10, 20, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} минут
                </option>
              ))}
            </select>
          </Field>
          <Field label="Тип действия" hint="Подготовка полезна. Но цель двигают внешние шаги.">
            <div className="row">
              <Button block variant={kind === 'prep' ? 'primary' : 'default'} onClick={() => setKind('prep')}>
                Подготовка
              </Button>
              <Button block variant={kind === 'reality' ? 'primary' : 'default'} onClick={() => setKind('reality')}>
                Проверка реальностью
              </Button>
            </div>
          </Field>
          <Button
            variant="primary"
            block
            disabled={!title.trim()}
            onClick={() => {
              dispatch({
                type: 'task/add',
                task: {
                  title: title.trim(),
                  firstStep: firstStep.trim() || 'Открыть то, где это делается',
                  firstStepMin: 2,
                  estimateMin: estimate,
                  kind,
                  stageId,
                },
              });
              setTitle('');
              setFirstStep('');
              setSheet(null);
            }}
          >
            Добавить
          </Button>
        </Sheet>
      )}

      {sheet === 'goal' && <GoalSheet onClose={() => setSheet(null)} />}

      {sheet === 'habit' && (
        <Sheet title="Новая привычка" subtitle="Привязываем к событию, а не только ко времени." onClose={() => setSheet(null)}>
          <div className="col">
            {HABIT_SEEDS.map((h) => (
              <Option
                key={h.title}
                label={`${h.title} — ${h.anchor.toLowerCase()}`}
                hint={`Минимум: ${h.minVersion.toLowerCase()} · Обычная: ${h.normalVersion.toLowerCase()} · Расширенная: ${h.extendedVersion.toLowerCase()}`}
                onClick={() => {
                  dispatch({
                    type: 'habit/add',
                    habit: { ...h, id: id('habit'), createdAt: new Date().toISOString(), active: true },
                  });
                  setSheet(null);
                }}
              />
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function GoalSheet({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Sheet
      title="Путь к цели"
      subtitle="Одновременно активна одна большая цель. Смена пути — осознанное решение, а не побег от трудной задачи."
      onClose={onClose}
    >
      <div className="col">
        {TRACKS.map((t) => (
          <Option key={t.id} label={t.title} hint={t.fit} on={picked === t.id} onClick={() => setPicked(t.id)} />
        ))}
      </div>
      {picked ? (
        <>
          <div style={{ height: 12 }} />
          <Notice>
            Текущие незавершённые задания прошлой цели будут убраны из плана. Сделанное останется в истории.
          </Notice>
          <div style={{ height: 10 }} />
          <Button
            variant="primary"
            block
            onClick={() => {
              const track = TRACKS.find((t) => t.id === picked);
              if (track) dispatch({ type: 'money/track', track, replaceGoal: true });
              onClose();
            }}
          >
            {state.goal ? 'Заменить цель' : 'Взять эту цель'}
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}
