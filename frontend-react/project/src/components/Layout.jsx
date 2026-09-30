/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../features/auth/AuthContext';
import Hero3D from './Hero3D';
import CollectorAppNotice from '../features/collection/CollectorAppNotice';
import SiteFooter from './SiteFooter';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { navFor, findActive, entryLink, HOME_DASHBOARD_KEY } from './navigation';
import SectionTabs from './SectionTabs';
import NotificationBell from '../features/notifications/NotificationBell';

const SIDEBAR_COLLAPSED_KEY = 'ewaste.sidebarCollapsed';

const navItem = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm mb-1 transition-colors duration-150';
const navItemActive = 'bg-mint-600 text-white font-semibold shadow-md shadow-mint-500/30';
const navItemInactive = 'text-ink-800 font-medium hover:bg-mint-50';
const sectionLabel = 'px-3 text-[11px] font-bold text-ink-600 mt-4 mb-1.5 uppercase tracking-wide font-mono';
const iconButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-800 transition-colors hover:bg-mint-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500';

const readCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

const roleLabel = (role) => {
  const r = role?.toLowerCase();
  if (!r) return '';
  if (r === 'staff') return 'Management staff';
  return r.charAt(0).toUpperCase() + r.slice(1);
};

export const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isStaff = user && ['staff', 'admin'].includes(user.role.toLowerCase());
  const isBuyer = user?.role.toLowerCase() === 'corporate';
  const isCollector = user?.role.toLowerCase() === 'collector';

  const sections = useMemo(() => navFor(user?.role), [user?.role]);
  const active = findActive(sections, location.pathname);

  // Desktop: the sidebar can shrink to an icon strip (remembered). Phones: it slides in over the page.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // storage unavailable: the choice just isn't remembered
    }
  };

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // "/" opens whichever dashboard (processing or sales) staff looked at last.
  useEffect(() => {
    if (isStaff && active?.entry.id === 'dashboard') {
      try {
        localStorage.setItem(HOME_DASHBOARD_KEY, active.tab.to);
      } catch {
        // storage unavailable: "/" just falls back to the default dashboard
      }
    }
  }, [isStaff, active?.entry.id, active?.tab.to]);

  // Collectors work from the Flutter app; the web shell has nothing for them.
  if (isCollector) return <CollectorAppNotice />;

  // Labels hide only on desktop when collapsed; the phone drawer always shows them.
  const hideWhenCollapsed = collapsed ? 'lg:hidden' : '';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* Same animated background language as the landing/auth pages, everywhere
          in the app — kept in "lite" mode here since this shell also has to
          render data tables, forms and charts on top of it. */}
      <div className="circuit-bg" />
      <div className="absolute inset-0 z-0">
        <Hero3D density="lite" />
      </div>
      <div className="bg-blob blob-1" style={{ opacity: 0.18 }} />
      <div className="bg-blob blob-2" style={{ opacity: 0.18 }} />

      {/* Top bar */}
      <header className="relative z-20 flex h-16 flex-shrink-0 items-center gap-2 border-b border-white/60 bg-white/55 px-3 backdrop-blur-xl sm:px-4">
        <button type="button" className={`${iconButton} lg:hidden`} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <button
          type="button"
          className={`${iconButton} hidden lg:inline-flex`}
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        <NavLink to="/" className="ml-1 flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 text-base text-white shadow-md shadow-mint-500/30">
            ♻
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block font-display text-sm font-bold">
              E-Waste<span className="text-mint-600">.</span>
            </span>
            <span className="block font-mono text-[10px] tracking-widest text-ink-600">MANAGEMENT SYSTEM</span>
          </span>
        </NavLink>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          {/* In-app notifications: unread badge + dropdown, wired to /api/notifications. */}
          <NotificationBell />

          <div className="hidden h-8 w-px bg-mint-100 sm:block" />

          <div className="hidden text-right sm:block">
            <div className="font-display text-sm font-bold leading-tight text-ink-900">{user?.fullName}</div>
            <div className="font-mono text-xs text-ink-600">{roleLabel(user?.role)}</div>
          </div>

          <button
            type="button"
            onClick={logout}
            aria-label="Logout"
            className="btn-glass-light inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
          >
            <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Below the top bar: sidebar + page */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* Phone drawer backdrop */}
        {drawerOpen && (
          <div className="fixed inset-x-0 bottom-0 top-16 z-30 bg-ink-900/30 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />
        )}

        {/* Sidebar: navigation only, every section always shown */}
        <aside
          aria-label="Main navigation"
          className={[
            'fixed bottom-0 left-0 top-16 z-40 flex w-64 flex-shrink-0 flex-col border-r border-white/60 bg-white/85 backdrop-blur-xl',
            'transition-[transform,width] duration-200 lg:static lg:z-10 lg:translate-x-0 lg:bg-white/55',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
            collapsed ? 'lg:w-[72px]' : 'lg:w-60',
          ].join(' ')}
        >
          <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-mint-100/70 px-4 lg:hidden">
            <span className="font-display text-sm font-bold">Menu</span>
            <button type="button" className={iconButton} onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            {sections.map((section, i) => (
              <div key={section.id}>
                {section.label && <div className={`${sectionLabel} ${hideWhenCollapsed}`}>{section.label}</div>}
                {collapsed && i > 0 && <div className="mx-2 my-3 hidden border-t border-mint-100 lg:block" />}
                {section.entries.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <NavLink
                      key={entry.id}
                      to={entryLink(entry)}
                      title={collapsed ? entry.label : undefined}
                      aria-label={entry.label}
                      className={[
                        navItem,
                        active?.entry.id === entry.id ? navItemActive : navItemInactive,
                        collapsed ? 'lg:justify-center lg:px-0' : '',
                      ].join(' ')}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      <span className={hideWhenCollapsed}>{entry.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content — fades between routes */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {active && active.entry.tabs.length > 1 && <SectionTabs tabs={active.entry.tabs} />}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>

          {!isStaff && (
            <SiteFooter
              inApp
              columns={[
                {
                  title: 'Your account',
                  links: [
                    { label: 'Dashboard', to: '/' },
                    { label: 'Submit an item', to: '/submissions/new' },
                    { label: 'My submissions', to: '/submissions/mine' },
                    ...(isBuyer ? [{ label: 'Material requests', to: '/material-requests' }] : []),
                  ],
                },
                {
                  title: 'Learn',
                  links: [
                    { label: 'How it works', href: '/welcome#how-it-works' },
                    { label: 'E-waste & impact', to: '/impact' },
                  ],
                },
              ]}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout;
