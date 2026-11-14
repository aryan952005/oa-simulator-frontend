import { useState } from 'react';

// DESIGN.md, Input Fields: 44px tall, white, 1px border-subtle, warm focus ring (never blue).
export function TextField({ id, label, error, icon, trailing, inputRef, ...inputProps }) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-space-xs">
      <label htmlFor={id} className="font-label-ui text-label-ui text-on-surface">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full h-11 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md border outline-none transition-shadow focus:border-primary-container focus:shadow-focus-ring ${
            icon ? 'pl-10' : 'pl-space-md'
          } ${trailing ? 'pr-12' : 'pr-space-md'} ${error ? 'border-error' : 'border-border-subtle'}`}
          {...inputProps}
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}

// A password field with a show/hide toggle (FD7). The toggle is a browser-only convenience.
export function PasswordField({ label, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      label={label}
      type={visible ? 'text' : 'password'}
      icon="lock"
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            {visible ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      }
    />
  );
}
