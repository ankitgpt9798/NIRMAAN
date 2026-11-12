// Shared Tailwind class strings for the admin area: large touch targets (≥ 44px).
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50';

export const btnPrimary = `${button} bg-brand-700 text-white hover:bg-brand-800`;
export const btnSecondary = `${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;
export const btnDanger = `${button} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
export const card = 'rounded-2xl border border-slate-200 bg-white';

export const inputBase =
  'block min-h-12 w-full rounded-xl border bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:outline-none disabled:bg-slate-100';
export const inputClass = (hasError) =>
  `${inputBase} ${hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-accent-500 focus:ring-accent-200'}`;
