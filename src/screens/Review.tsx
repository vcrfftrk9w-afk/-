import { useMemo, useState } from 'react';
import { Button, Card, Field, Kpi, Notice } from '../components/ui';
import { APP_METRIC_NOTE, outsideImpact, timeOfDayStats, weekMetrics } from '../domain/metrics';
import { buildHypothesis, LOAD_RULE, REVIEW_QUESTIONS } from '../domain/review';
import { formatMinutes, isoDate, weekStart } from '../lib/date';
import { useAppState, useDispatch } from '../store/StoreContext';

export function Review() {
  const state = useAppState();
  const dispatch = useDispatch();
  const today = isoDate();
  const m = useMemo(() => weekMetrics(state, today), [state, today]);
  const parts = useMemo(() => timeOfDayStats(state), [state]);
  const hypothesis = useMemo(() => buildHypothesis(state, today), [state, today]);
  const impact = outsideImpact(state);

  const [answers, setAnswers] = useState({ movedForward: '', tooHeavy: '', removeNextWeek: '' });
  const [saved, setSaved] = useState(false);

  function save(accepted: boolean) {
    dispatch({
      type: 'review/add',
      review: {
        weekStart: weekStart(today),
        movedForward: answers.movedForward.trim(),
        tooHeavy: answers.tooHeavy.trim(),
        removeNextWeek: answers.removeNextWeek.trim(),
        hypothesis,
        acceptedHypothesis: accepted,
      },
    });
    setAnswers({ movedForward: '', tooHeavy: '', removeNextWeek: '' });
    setSaved(true);
  }

  return (
    <div className="screen">
      <Card>
        <h2>Неделя в фактах</h2>
        <p className="small muted">
          {m.from} — {m.to}
        </p>
        <div className="kpi-grid">
          <Kpi value={m.done} label="действий завершено" />
          <Kpi value={m.realityChecks} label="внешних шагов" />
          <Kpi value={m.prep} label="подготовки" />
          <Kpi
            value={m.startRate === null ? '—' : `${Math.round(m.startRate * 100)}%`}
            label="запланированного начато"
          />
          <Kpi value={m.postponed} label="переносов" />
          <Kpi value={formatMinutes(m.focusMinutes)} label="в фокус-блоках" />
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          {APP_METRIC_NOTE}
        </p>
      </Card>

      <Card>
        <h3>Когда легче начинать</h3>
        <div className="list">
          {parts.map((p) => (
            <div key={p.part} className="list-item">
              <div className="small">{p.label}</div>
              <div className="tiny muted">
                начато {p.started} · доведено до конца {p.done}
              </div>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Это наблюдение по твоим же действиям, а не утверждение о твоём характере.
        </p>
      </Card>

      <Card accent>
        <h2>Короткая перенастройка</h2>
        <p className="small muted">Три вопроса. Это не суд над собой.</p>
        {REVIEW_QUESTIONS.map((q) => (
          <Field key={q.key} label={q.question} hint={q.hint}>
            <textarea
              className="input"
              value={answers[q.key]}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
            />
          </Field>
        ))}

        <div className="notice" style={{ marginBottom: 12 }}>
          <strong>Гипотеза на следующую неделю</strong>
          <div style={{ marginTop: 6 }}>{hypothesis}</div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            Это предположение, которое можно проверить, а не заявление, что приложение изучило твой мозг.
          </div>
        </div>

        <div className="row">
          <Button variant="primary" block onClick={() => save(true)}>
            Принять гипотезу
          </Button>
          <Button block variant="ghost" onClick={() => save(false)}>
            Сохранить без неё
          </Button>
        </div>
        {saved ? <p className="tiny muted" style={{ marginTop: 10 }}>Разбор сохранён.</p> : null}
        <div style={{ height: 10 }} />
        <Notice>{LOAD_RULE}</Notice>
      </Card>

      <Card flat>
        <h3>Что произошло вне приложения</h3>
        <div className="kpi-grid">
          <Kpi value={impact.actions} label="завершённых действий" />
          <Kpi value={impact.outcomes} label="заявок, работ, контактов, оплат" />
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Главная метрика приложения — помогает ли оно делать важное снаружи. Не сколько времени ты проводишь внутри.
        </p>
      </Card>

      {state.reviews.length > 0 ? (
        <Card flat>
          <h3>Прошлые разборы</h3>
          <div className="list">
            {state.reviews.slice(0, 8).map((r) => (
              <div key={r.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="tiny muted">неделя с {r.weekStart}</div>
                {r.movedForward ? <div className="small">Сдвинуло: {r.movedForward}</div> : null}
                {r.tooHeavy ? <div className="small muted">Тяжело: {r.tooHeavy}</div> : null}
                {r.removeNextWeek ? <div className="small muted">Убрали: {r.removeNextWeek}</div> : null}
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {r.acceptedHypothesis ? 'Гипотеза принята: ' : 'Гипотеза отклонена: '}
                  {r.hypothesis}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
