import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Globe, LogOut, Menu, Store, X } from 'lucide-react';
import LanguageSwitcher from '../components/public/LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { ADMIN_NAV } from '../pages/admin/adminNav';

const linkClass = ({ isActive }) =>
  `flex min-h-12 items-center gap-3 rounded-xl px-4 text-base font-medium ${
    isActive ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-brand-50'
  }`;

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-dvh bg-slate-50">
      <meta name="robots" content="noindex, nofollow" />

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="admin-menu"
              aria-label={menuOpen ? t('admin.nav.close') : t('admin.nav.open')}
            >
              {menuOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
            </button>
            <Store className="hidden size-7 shrink-0 text-brand-700 sm:block" aria-hidden="true" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-lg font-bold text-brand-800">{t('admin.brand')}</p>
              <p className="truncate text-sm text-slate-500">{admin?.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher tone="light" compact id="admin-language-label" />
            {/* Icon only on phones (the text is its accessible name), text on larger screens. */}
            <button
              type="button"
              onClick={logout}
              aria-label={t('admin.logout')}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 sm:px-4"
            >
              <LogOut className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('admin.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4 md:py-6">
        <nav
          id="admin-menu"
          aria-label={t('admin.nav.menu')}
          className={`${menuOpen ? 'block' : 'hidden'} fixed inset-x-0 top-16 bottom-0 z-10 overflow-y-auto bg-white p-4 md:static md:block md:w-60 md:shrink-0 md:bg-transparent md:p-0 print:hidden`}
        >
          <ul className="space-y-1">
            {ADMIN_NAV.map(({ path, labelKey, icon: Icon }) => (
              <li key={path}>
                <NavLink to={`/admin/${path}`} className={linkClass} onClick={closeMenu}>
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {t(labelKey)}
                </NavLink>
              </li>
            ))}
            <li className="border-t border-slate-200 pt-2">
              {/* Same tab: the customer site shows an Admin button to come back. */}
              <Link to="/" onClick={closeMenu} className={linkClass({ isActive: false })}>
                <Globe className="size-5 shrink-0" aria-hidden="true" />
                {t('admin.nav.viewWebsite')}
              </Link>
            </li>
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
