import { cloneElement, isValidElement, useEffect, useId } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  block?: boolean;
  size?: 'md' | 'sm';
};

export function Button({ variant = 'default', block, size = 'md', className = '', ...rest }: BtnProps) {
  const cls = [
    'btn',
    variant !== 'default' ? variant : '',
    block ? 'block' : '',
    size === 'sm' ? 'small' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button className={cls} {...rest} />;
}

export function Card({ children, accent, flat, className = '' }: { children: ReactNode; accent?: boolean; flat?: boolean; className?: string }) {
  return <section className={['card', accent ? 'accent' : '', flat ? 'flat' : '', className].filter(Boolean).join(' ')}>{children}</section>;
}

export function Chip({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={`chip${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  );
}

export function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted small">{subtitle}</p> : null}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  // Метка связывается с полем: иначе она не читается вспомогательными технологиями.
  const fieldId = useId();
  const single = isValidElement(children) ? (children as ReactElement<{ id?: string }>) : null;
  const linked = single && !single.props.id;
  const content = linked ? cloneElement(single, { id: fieldId }) : children;

  return (
    <div className="field">
      <label htmlFor={linked ? fieldId : undefined}>{label}</label>
      {content}
      {hint ? <span className="tiny muted">{hint}</span> : null}
    </div>
  );
}

export function Option({ on, label, hint, onClick }: { on?: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" className={`option${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on}>
      <div className="label">{label}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </button>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Kpi({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="kpi">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <span>
        <span>{label}</span>
        {hint ? <div className="tiny muted">{hint}</div> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>;
}
