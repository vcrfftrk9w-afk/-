import { useState } from 'react';
import { Button, Card, Field, Kpi, Notice, Option, Sheet } from '../components/ui';
import { TRACKS, findTrack } from '../domain/templates';
import type { Outcome, OutcomeKind } from '../domain/types';
import { useAppState, useDispatch } from '../store/StoreContext';

const OUTCOME_LABEL: Record<OutcomeKind, string> = {
  portfolio: 'готовая работа',
  application: 'отправленная заявка',
  conversation: 'разговор с клиентом',
  interview: 'собеседование',
  offer: 'предложение о работе',
  payment: 'оплата',
};

/**
 * Приложение не может гарантировать богатство. Оно помогает в трёх вещах:
 * понимать положение, повышать потенциальный доход и делать действия,
 * которые обычно откладываются.
 */
export function Money() {
  const state = useAppState();
  const dispatch = useDispatch();
  const m = state.money;
  const [sheet, setSheet] = useState<'track' | 'outcome' | 'debt' | null>(null);
  const [debtName, setDebtName] = useState('');
  const [debtAmount, setDebtAmount] = useState(0);
  const [outcomeKind, setOutcomeKind] = useState<OutcomeKind>('application');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [outcomeAmount, setOutcomeAmount] = useState<number | ''>('');

  const debtTotal = m.debts.reduce((s, d) => s + d.amount, 0);
  const left = m.monthlyIncome - m.mandatoryExpenses;
  const reserveMonths = m.mandatoryExpenses > 0 ? m.reserve / m.mandatoryExpenses : 0;
  const track = findTrack(m.trackId);

  return (
    <div className="screen">
      <Card>
        <h2>Финансовая картина</h2>
        <p className="small muted">
          Начать можно с ручного ввода. Подключение банка необязательно и здесь не требуется.
        </p>
        <Field label={`Доход в месяц, ${m.currency}`}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={m.monthlyIncome || ''}
            onChange={(e) => dispatch({ type: 'money/update', patch: { monthlyIncome: Number(e.target.value) || 0 } })}
          />
        </Field>
        <Field label={`Обязательные расходы, ${m.currency}`}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={m.mandatoryExpenses || ''}
            onChange={(e) => dispatch({ type: 'money/update', patch: { mandatoryExpenses: Number(e.target.value) || 0 } })}
          />
        </Field>
        <Field label={`Резерв, ${m.currency}`} hint="Сколько месяцев обязательных расходов покрыто.">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={m.reserve || ''}
            onChange={(e) => dispatch({ type: 'money/update', patch: { reserve: Number(e.target.value) || 0 } })}
          />
        </Field>

        <div className="kpi-grid" style={{ marginTop: 8 }}>
          <Kpi value={`${left.toLocaleString('ru-RU')} ${m.currency}`} label="остаётся после расходов" />
          <Kpi value={`${debtTotal.toLocaleString('ru-RU')} ${m.currency}`} label="долги" />
          <Kpi value={reserveMonths ? `${reserveMonths.toFixed(1)} мес` : '—'} label="резерв покрывает" />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <Button size="sm" onClick={() => setSheet('debt')}>
            + долг
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'money/snapshot' })}>
            Сохранить срез месяца
          </Button>
        </div>

        {m.debts.length > 0 ? (
          <div className="list" style={{ marginTop: 12 }}>
            {m.debts.map((d) => (
              <div key={d.id} className="list-item">
                <div className="small">{d.name}</div>
                <div className="row">
                  <span className="badge">
                    {d.amount.toLocaleString('ru-RU')} {m.currency}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'money/debt-remove', debtId: d.id })}>
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card accent>
        <h2>Путь роста дохода</h2>
        {track ? (
          <>
            <strong>{track.title}</strong>
            <p className="small muted">{track.fit}</p>
          </>
        ) : (
          <p className="small muted">Основной путь пока не выбран.</p>
        )}
        <Button size="sm" onClick={() => setSheet('track')}>
          {track ? 'Сменить путь' : 'Выбрать путь'}
        </Button>
        <div style={{ height: 12 }} />
        <Notice>
          Не всем нужно становиться предпринимателями. Иногда самый разумный путь — улучшить резюме, подготовиться к
          собеседованиям и перейти на более подходящую работу.
        </Notice>
      </Card>

      <Card>
        <h2>Внешние результаты</h2>
        <p className="small muted">
          Просмотр курса — полезная подготовка. Отправленная заявка, собеседование, разговор с клиентом и оплаченный
          заказ — другие события. Здесь считаем именно их.
        </p>
        <Button size="sm" onClick={() => setSheet('outcome')}>
          + результат
        </Button>
        <div className="list" style={{ marginTop: 12 }}>
          {m.outcomes.length === 0 ? (
            <p className="tiny muted">Пока пусто. Первый внешний шаг обычно самый дорогой — и самый полезный.</p>
          ) : (
            m.outcomes.map((o: Outcome) => (
              <div key={o.id} className="list-item">
                <div>
                  <div className="small">{o.note || OUTCOME_LABEL[o.kind]}</div>
                  <div className="tiny muted">
                    {OUTCOME_LABEL[o.kind]} · {o.at.slice(0, 10)}
                    {o.amount ? ` · ${o.amount.toLocaleString('ru-RU')} ${m.currency}` : ''}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'money/outcome-remove', outcomeId: o.id })}>
                  ✕
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      {m.snapshots.length > 0 ? (
        <Card flat>
          <h3>Как меняется картина</h3>
          <div className="list">
            {m.snapshots.map((s) => (
              <div key={s.id} className="list-item">
                <div className="small">{s.month}</div>
                <div className="tiny muted">
                  доход {s.income.toLocaleString('ru-RU')} · расходы {s.expenses.toLocaleString('ru-RU')} · резерв{' '}
                  {s.reserve.toLocaleString('ru-RU')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Notice>
        Никаких обещаний «миллион за месяц», азартных механик и предложений занимать деньги ради сомнительной схемы.
        Денежных штрафов за срывы тоже нет: приложение, которое зарабатывает на твоих срывах, имеет сомнительную
        мотивацию.
      </Notice>

      {sheet === 'track' && (
        <Sheet
          title="Один основной путь"
          subtitle="Выбор пути создаст этапы и конкретные задания на вкладке «Путь»."
          onClose={() => setSheet(null)}
        >
          <div className="col">
            {TRACKS.map((t) => (
              <Option
                key={t.id}
                label={t.title}
                hint={t.fit}
                on={m.trackId === t.id}
                onClick={() => {
                  dispatch({ type: 'money/track', track: t, replaceGoal: true });
                  setSheet(null);
                }}
              />
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'debt' && (
        <Sheet title="Долг" onClose={() => setSheet(null)}>
          <Field label="Название">
            <input className="input" value={debtName} onChange={(e) => setDebtName(e.target.value)} />
          </Field>
          <Field label={`Сумма, ${m.currency}`}>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={debtAmount || ''}
              onChange={(e) => setDebtAmount(Number(e.target.value) || 0)}
            />
          </Field>
          <Button
            variant="primary"
            block
            disabled={!debtName.trim()}
            onClick={() => {
              dispatch({ type: 'money/debt-add', name: debtName.trim(), amount: debtAmount });
              setDebtName('');
              setDebtAmount(0);
              setSheet(null);
            }}
          >
            Добавить
          </Button>
        </Sheet>
      )}

      {sheet === 'outcome' && (
        <Sheet title="Внешний результат" subtitle="То, что произошло за пределами приложения." onClose={() => setSheet(null)}>
          <div className="col">
            {(Object.keys(OUTCOME_LABEL) as OutcomeKind[]).map((k) => (
              <Option key={k} label={OUTCOME_LABEL[k]} on={outcomeKind === k} onClick={() => setOutcomeKind(k)} />
            ))}
          </div>
          <div style={{ height: 12 }} />
          <Field label="Короткая заметка">
            <input className="input" value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} />
          </Field>
          {outcomeKind === 'payment' ? (
            <Field label={`Сумма, ${m.currency}`}>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={outcomeAmount}
                onChange={(e) => setOutcomeAmount(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>
          ) : null}
          <Button
            variant="primary"
            block
            onClick={() => {
              dispatch({
                type: 'money/outcome-add',
                outcome: {
                  kind: outcomeKind,
                  note: outcomeNote.trim(),
                  amount: outcomeAmount === '' ? undefined : outcomeAmount,
                },
              });
              setOutcomeNote('');
              setOutcomeAmount('');
              setSheet(null);
            }}
          >
            Записать
          </Button>
        </Sheet>
      )}
    </div>
  );
}
