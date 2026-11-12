import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CircleAlert, Eye, EyeOff, Globe, Info, LoaderCircle, LockKeyhole } from 'lucide-react';
import FullPageLoader from '../../components/FullPageLoader';
import LanguageSwitcher from '../../components/public/LanguageSwitcher';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { fillTemplate } from '../../i18n/fill';

const inputClass =
  'mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg text-slate-900 placeholder:text-slate-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-200 focus:outline-none';

export default function LoginPage() {
  const { status, notice, login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.startsWith('/admin/') ? location.state.from : '/admin/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The error itself is kept (not its text), so it is shown in whichever language is selected.
  const [failure, setFailure] = useState(null);

  if (status === 'checking') return <FullPageLoader label={t('admin.login.checking')} />;
  if (status === 'signed-in') return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setFailure({ i18nKey: 'admin.login.missing' });
      return;
    }
    setSubmitting(true);
    setFailure(null);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFailure(err);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  const errorText = failure ? apiErrorMessage(failure, t, 'admin.login.failed') : '';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <title>{`${t('admin.login.title')} · ${t('admin.brand')}`}</title>
      <meta name="robots" content="noindex, nofollow" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent-700 hover:underline">
          <Globe className="size-4" aria-hidden="true" />
          {t('admin.nav.viewWebsite')}
        </Link>
        <LanguageSwitcher tone="light" compact id="login-language-label" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-50">
          <LockKeyhole className="size-7 text-brand-700" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-brand-800">{t('admin.login.title')}</h1>

        {notice && !errorText && (
          <p className="mt-5 flex gap-2 rounded-xl bg-accent-50 p-3 text-accent-700" role="status">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {t(notice)}
          </p>
        )}
        {errorText && (
          <p className="mt-5 flex gap-2 rounded-xl bg-red-50 p-3 text-red-700" role="alert">
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {errorText}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="font-medium text-slate-700">
              {t('admin.login.email')}
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="font-medium text-slate-700">
              {t('admin.login.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-14`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute inset-y-0 right-1 my-auto inline-flex size-11 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? t('admin.login.hidePassword') : t('admin.login.showPassword')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-lg font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {submitting && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
            {submitting ? t('admin.login.submitting') : t('admin.login.submit')}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        {fillTemplate(t('admin.login.forgot'), {
          command: <code className="rounded bg-slate-200 px-1 text-slate-800">npm run create-admin</code>,
        })}
      </p>
    </main>
  );
}
