import { type ReactNode, useEffect, useState } from 'react';
import type { Units } from '../model/schema';
import { formatLength, parseLength } from '../units/format';

/** Unit-aware length input: shows ft-in or m, accepts either when typed. Value in meters. */
export function LengthInput({
  value,
  units,
  onChange,
  min,
  max,
  testId,
  label,
}: {
  value: number;
  units: Units;
  onChange: (m: number) => void;
  min?: number;
  max?: number;
  testId?: string;
  label?: string;
}) {
  const shown = formatLength(value, units, { inchStep: units === 'imperial' ? 0.5 : undefined });
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!editing) setText(shown);
  }, [shown, editing]);

  const commit = () => {
    const v = parseLength(text, units);
    if (v === null || (min !== undefined && v < min) || (max !== undefined && v > max)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setEditing(false);
    if (Math.abs(v - value) > 1e-6) onChange(v);
    else setText(shown);
  };

  return (
    <input
      className={`input input-num${invalid ? ' invalid' : ''}`}
      value={text}
      aria-label={label}
      data-testid={testId}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setText(shown);
          setEditing(false);
          setInvalid(false);
          (e.target as HTMLInputElement).blur();
        }
        e.stopPropagation();
      }}
    />
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (text !== value) onChange(text);
  };
  const common = {
    className: 'input',
    value: text,
    placeholder,
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) (e.target as HTMLInputElement).blur();
      e.stopPropagation();
    },
  };
  return multiline ? (
    <textarea {...common} rows={2} onChange={(e) => setText(e.target.value)} />
  ) : (
    <input {...common} onChange={(e) => setText(e.target.value)} />
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div className="slider-row">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="subtle" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {format(value)}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode; title?: string; testId?: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          data-testid={o.testId}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
