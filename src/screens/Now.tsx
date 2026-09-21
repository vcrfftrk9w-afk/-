import { useMemo, useState } from 'react';
import { Button, Card, Chip, Field, Kpi, Notice } from '../components/ui';
import { BlockerSheet, PostponeSheet, StuckSheet } from '../components/HelpSheets';
import { CommitmentSheet } from '../components/CommitmentSheet';
import { habitStats, habitVersion, MIN_VERSION_NOTE } from '../domain/habits';
import { habitsForToday, needsRealityCheck, pickNextStep, tasksNeedingReview } from '../domain/engine';
import { canSimplify, currentStep } from '../domain/simplify';
import type { Capacity, HabitLevel, Task } from '../domain/types';
import { dueReminder } from '../domain/reminders';
import { formatMinutes, isoDate } from '../lib/date';
import { useNow } from '../lib/useNow';
import { useAppState, useDispatch } from '../store/StoreContext';
import type { FocusConfig } from './Focus';

const CAPACITY_LABEL: Record<Capacity, string> = {
  low: 'мало сил',
  normal: 'обычная нагрузка',
  full: 'полная нагрузка',
};

const WINDOWS = [10, 25, 50];

export function Now({ onFocus }: { onFocus: (config: FocusConfig) => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [sheet, setSheet] = useState<'stuck' | 'blocker' | 'postpone' | 'commitment' | null>(null);
  const [quickTask, setQuickTask] = useState('');

  const now = useNow();
  const today = isoDate(now);
  const next = useMemo(
    () => pickNextStep(state, { now, windowMin: state.day.windowMin, capacity: state.day.capacity }),
    [state, now],
  );
  const reminder = useMemo(() => dueReminder(state, now), [state, now]);
  const task: Task | null = next?.task ?? null;
  const habits = habitsForToday(state, today);
  const todayCommitments = state.commitments.filter((c) => c.date === today && c.status === 'planned');
  const review = tasksNeedingReview(state, today);
  const singleTask = state.profile?.features.singleTask ?? false;

  const upcoming = useMemo(
    () =>
      state.tasks
        .filter((t) => t.status === 'todo' && t.id !== task?.id)
        .slice(0, singleTask ? 0 : 3),
    [state.tasks, task?.id, singleTask],
  );

  function startFocus(minutes: number, intent: string, taskId?: string, companion: FocusConfig['companion'] = 'solo') {
    const commitment = todayCommitments.find((c) => c.taskId === taskId);
    onFocus({ taskId, intent, minutes, companion, limited: commitment?.limited ?? [] });
  }

  function beginNextStep() {
    if (!next || !task) return;
    const minutes = Math.max(5, Math.min(next.stepMinutes, state.day.windowMin));
    startFocus(minutes, next.stepText, task.id);
  }

  return (
    <div className="screen">
      <Card accent>
        <div className="row between">
          <div className="muted small">Сегодня: {CAPACITY_LABEL[state.day.capacity]}</div>
          <div className="muted small">Свободное окно: {formatMinutes(state.day.windowMin)}</div>
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          {(['low', 'normal', 'full'] as Capacity[]).map((c) => (
            <Chip key={c} on={state.day.capacity === c} onClick={() => dispatch({ type: 'day/set', capacity: c })}>
              {CAPACITY_LABEL[c]}
            </Chip>
          ))}
        </div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          {WINDOWS.map((w) => (
            <Chip key={w} on={state.day.windowMin === w} onClick={() => dispatch({ type: 'day/set', windowMin: w })}>
              {w} мин
            </Chip>
          ))}
        </div>
      </Card>

      {reminder ? (
        <Card accent>
          <div className="badge">{reminder.kind === 'due' ? 'договорённость' : 'повторный запрос'}</div>
          <h2 style={{ marginTop: 10 }}>{reminder.title}</h2>
          <p className="small muted">{reminder.body}</p>
          <div className="row wrap">
            <Button
              variant="primary"
              onClick={() =>
                startFocus(
                  reminder.kind === 'again' ? Math.min(5, reminder.commitment.durationMin) : reminder.commitment.durationMin,
                  reminder.kind === 'again' && next ? next.stepText : reminder.commitment.title,
                  reminder.commitment.taskId,
                  'solo',
                )
              }
            >
              {reminder.kind === 'again' ? 'Маленькая версия' : 'Начать'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: 'commitment/status', commitmentId: reminder.commitment.id, status: 'skipped' })}
            >
              Не сегодня
            </Button>
          </div>
        </Card>
      ) : null}

      {next && task ? (
        <Card>
          <div className="meta-line">
            <span className="badge">{next.reason}</span>
            {task.kind === 'reality' ? <span className="badge reality">внешний шаг</span> : null}
            {next.friction ? <span className="badge friction">буксует</span> : null}
            {next.fromCommitment ? <span className="badge">по контракту</span> : null}
          </div>

          <div className="muted small" style={{ marginTop: 12 }}>
            Следующий шаг:
          </div>
          <div className="step-title">{next.stepText}</div>

          <div className="meta-line">
            <span>Первый шаг — {formatMinutes(task.firstStepMin)}.</span>
            <span>Полная задача — около {formatMinutes(task.estimateMin)}.</span>
          </div>

          {task.resumeHint ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Подсказка с прошлого раза: {task.resumeHint}
            </div>
          ) : null}

          <div className="col" style={{ marginTop: 16 }}>
            <Button variant="primary" block onClick={beginNextStep}>
              Начать
            </Button>
            <div className="row">
              <Button
                block
                disabled={!canSimplify(task)}
                onClick={() => dispatch({ type: 'task/simplify', taskId: task.id })}
              >
                Сделать проще
              </Button>
              <Button block onClick={() => setSheet('blocker')}>
                Мне что-то мешает
              </Button>
            </div>
            <div className="row">
              <Button block variant="ghost" onClick={() => setSheet('stuck')}>
                Я завис
              </Button>
              <Button block variant="ghost" onClick={() => dispatch({ type: 'task/done', taskId: task.id })}>
                Сделано
              </Button>
            </div>
            <div className="row">
              <Button block variant="ghost" size="sm" onClick={() => setSheet('postpone')}>
                Перенести
              </Button>
              <Button block variant="ghost" size="sm" onClick={() => setSheet('commitment')}>
                Договориться о времени
              </Button>
            </div>
          </div>

          {canSimplify(task) && task.simplifyLevel > 0 ? (
            <p className="tiny muted" style={{ marginTop: 12 }}>
              Задача упрощена {task.simplifyLevel} {task.simplifyLevel === 1 ? 'раз' : 'раза'}. Полная версия никуда не
              делась: «{task.title}».
            </p>
          ) : null}
        </Card>
      ) : (
        <Card>
          <h2>На сегодня следующего шага нет</h2>
          <p className="small muted">
            Это нормальный ответ. Можно добавить действие или закончить день — догонять упущенное не нужно.
          </p>
          <Field label="Добавить одно действие">
            <div className="row">
              <input
                className="input"
                value={quickTask}
                onChange={(e) => setQuickTask(e.target.value)}
                placeholder="Например: обновить раздел резюме"
              />
              <Button
                onClick={() => {
                  if (!quickTask.trim()) return;
                  dispatch({
                    type: 'task/add',
                    task: {
                      title: quickTask.trim(),
                      firstStep: 'Открыть то, где это делается',
                      firstStepMin: 2,
                      estimateMin: 20,
                      kind: 'prep',
                      scheduledFor: today,
                    },
                  });
                  setQuickTask('');
                }}
              >
                Добавить
              </Button>
            </div>
          </Field>
        </Card>
      )}

      {needsRealityCheck(state) ? (
        <Notice>
          Ты много готовился, но ещё не проверял спрос. Давай сделаем маленький внешний шаг: отправить, спросить или
          показать работу одному человеку.
        </Notice>
      ) : null}

      {habits.length > 0 ? (
        <Card>
          <h2>Привычки</h2>
          <p className="tiny muted">{MIN_VERSION_NOTE}</p>
          <div className="list">
            {habits.map(({ habit, doneToday }) => {
              const stats = habitStats(state, habit, today);
              return (
                <div key={habit.id} className={`list-item${doneToday ? ' done' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div>
                    <strong>{habit.title}</strong>
                    <div className="tiny muted">{habit.anchor.toLowerCase()}</div>
                    <div className="tiny muted">{stats.phrase}</div>
                  </div>
                  {doneToday ? (
                    <div className="row" style={{ marginTop: 8 }}>
                      <span className="badge">сегодня выполнено</span>
                      <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'habit/unlog', habitId: habit.id })}>
                        Отменить
                      </Button>
                    </div>
                  ) : (
                    <div className="row wrap" style={{ marginTop: 8 }}>
                      {(['min', 'normal', 'extended'] as HabitLevel[]).map((level) => {
                        const v = habitVersion(habit, level);
                        return (
                          <Button
                            key={level}
                            size="sm"
                            onClick={() => dispatch({ type: 'habit/log', habitId: habit.id, level })}
                          >
                            {level === 'min' ? 'Минимум' : level === 'normal' ? 'Обычная' : 'Расширенная'} · {v.minutes} мин
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2>Делаем рядом</h2>
        <p className="small muted">
          Совместный фокус помогает удерживаться в процессе. Камера не нужна: показывать квартиру, лицо или документы
          не требуется.
        </p>
        <div className="row wrap">
          {[15, 25, 50].map((m) => (
            <Button
              key={m}
              size="sm"
              onClick={() => startFocus(m, next?.stepText ?? 'Работаем над своим делом', task?.id, 'auto')}
            >
              Сессия {m} мин
            </Button>
          ))}
        </div>
        <div style={{ height: 10 }} />
        <Notice>
          Живого партнёра здесь нет: это одиночная сессия с короткими проверками. Приложение честно говорит, что это
          автоматическое сопровождение, а не человек.
        </Notice>
      </Card>

      {todayCommitments.length > 0 ? (
        <Card>
          <h2>Сегодняшние договорённости</h2>
          <div className="list">
            {todayCommitments.map((c) => (
              <div key={c.id} className="list-item">
                <div>
                  <strong>
                    {c.start} · {formatMinutes(c.durationMin)}
                  </strong>
                  <div className="small">{c.title}</div>
                  {c.limited.length > 0 ? <div className="tiny muted">ограничено: {c.limited.join(', ')}</div> : null}
                </div>
                <div className="col">
                  <Button size="sm" onClick={() => startFocus(c.durationMin, c.title, c.taskId, 'solo')}>
                    Начать
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'commitment/remove', commitmentId: c.id })}>
                    Убрать
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {review.length > 0 ? (
        <Card>
          <h2>Переоценка</h2>
          <p className="small muted">
            Пропущенные задачи не превращаются автоматически в долг. Часть из них стоит удалить — это нормальный ход.
          </p>
          <div className="list">
            {review.map((t) => (
              <div key={t.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div>
                  <strong>{currentStep(t).text}</strong>
                  <div className="tiny muted">
                    планировалось на {t.scheduledFor} · переносов: {t.postponedCount}
                  </div>
                </div>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  <Button size="sm" onClick={() => dispatch({ type: 'task/schedule', taskId: t.id, date: today })}>
                    Оставить на сегодня
                  </Button>
                  <Button size="sm" onClick={() => dispatch({ type: 'task/simplify', taskId: t.id })}>
                    Упростить
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => dispatch({ type: 'task/drop', taskId: t.id })}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {upcoming.length > 0 ? (
        <Card flat>
          <h3>Дальше в плане</h3>
          <div className="list">
            {upcoming.map((t) => (
              <div key={t.id} className="list-item">
                <div className="small">{t.title}</div>
                <span className="badge">{formatMinutes(t.estimateMin)}</span>
              </div>
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Список не для того, чтобы сделать всё сегодня. Он нужен, чтобы ничего не держать в голове.
          </p>
        </Card>
      ) : null}

      {state.parking.length > 0 ? (
        <Card flat>
          <h3>Отвлекающие мысли</h3>
          <div className="list">
            {state.parking.slice(0, 5).map((p) => (
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
      ) : null}

      <div className="kpi-grid">
        <Kpi value={state.tasks.filter((t) => t.status === 'done').length} label="действий завершено" />
        <Kpi value={state.money.outcomes.length} label="внешних результатов" />
      </div>

      {sheet === 'stuck' && (
        <StuckSheet
          task={task}
          onClose={() => setSheet(null)}
          onReason={(reason) => dispatch({ type: 'stuck/log', reason, taskId: task?.id })}
          handlers={{
            onSimplify: () => task && dispatch({ type: 'task/simplify', taskId: task.id }),
            onDraft: () => startFocus(5, task ? `Черновик: ${task.title}` : 'Черновик на 5 минут', task?.id),
            onFocus: () => startFocus(Math.min(25, state.day.windowMin), next?.stepText ?? 'Фокус-блок', task?.id),
            onPark: (text) => dispatch({ type: 'parking/add', text }),
            onPostpone: () => setSheet('postpone'),
            onRest: () => dispatch({ type: 'day/set', capacity: 'low' }),
            onStart: beginNextStep,
          }}
        />
      )}

      {sheet === 'blocker' && task && (
        <BlockerSheet
          task={task}
          onClose={() => setSheet(null)}
          onSimplify={() => dispatch({ type: 'task/simplify', taskId: task.id })}
          onStart={beginNextStep}
        />
      )}

      {sheet === 'postpone' && task && (
        <PostponeSheet
          task={task}
          strict={state.profile?.strictness === 'strict'}
          onClose={() => setSheet(null)}
          onConfirm={(reason, until) => {
            dispatch({ type: 'task/postpone', taskId: task.id, reason, until });
            setSheet(null);
          }}
        />
      )}

      {sheet === 'commitment' && (
        <CommitmentSheet
          task={task}
          defaultStrictness={state.profile?.strictness ?? 'structured'}
          onClose={() => setSheet(null)}
          onCreate={(c) => {
            dispatch({ type: 'commitment/add', commitment: c });
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
