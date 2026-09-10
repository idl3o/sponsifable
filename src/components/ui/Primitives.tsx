import type { ReactNode } from 'react';

/** Shared presentational building blocks. No domain knowledge lives here. */

export function Card({
  title,
  subtitle,
  children,
  tight,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={tight ? 'card tight' : 'card'}>
      {(title || subtitle) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {subtitle && <div className="note">{subtitle}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input value={value} placeholder={placeholder ?? ''} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  step,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  step?: number;
  min?: number;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step ?? 1}
        min={min ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone = 'plain',
}: {
  children: ReactNode;
  tone?: 'plain' | 'good' | 'warn' | 'bad' | 'accent';
}) {
  return <span className={tone === 'plain' ? 'pill' : `pill ${tone}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant = 'default',
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'ghost';
  title?: string;
}) {
  const cls = variant === 'default' ? 'btn' : `btn ${variant}`;
  return (
    <button type="button" className={cls} onClick={onClick} title={title ?? ''}>
      {children}
    </button>
  );
}

/** Format a GBP amount for display. */
export function money(amount: number): string {
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

/** Format a count with thousands separators. */
export function count(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}
