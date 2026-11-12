import { inputClass } from './styles';

function describedBy(id, hint, error) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

export function Field({ id, label, hint, error, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="block font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ id, label, hint, error, required, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        name={id}
        className={inputClass(Boolean(error))}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        aria-required={required || undefined}
        {...props}
      />
    </Field>
  );
}

export function TextArea({ id, label, hint, error, rows = 3, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={id}
        rows={rows}
        className={`${inputClass(Boolean(error))} py-3`}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Field>
  );
}

export function SelectInput({ id, label, hint, error, required, children, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <select
        id={id}
        name={id}
        className={inputClass(Boolean(error))}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        aria-required={required || undefined}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

export function CheckboxField({ id, label, hint, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-brand-700"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <span>
        <span className="block font-medium text-slate-800">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="block text-sm text-slate-500">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
