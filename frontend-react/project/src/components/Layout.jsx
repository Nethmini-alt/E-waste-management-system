/* eslint-disable no-unused-vars */
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../features/auth/AuthContext';
import Hero3D from './Hero3D';
import {
  LayoutDashboard, Users, Tag, ShoppingCart, Ship, DollarSign,
  Bot, CheckSquare, Package, LogOut, Send, Truck, Recycle, Lock, ClipboardList,
} from 'lucide-react';

const navItem =
  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm mb-1 transition-colors duration-150';
const navItemActive = 'bg-mint-600 text-white font-semibold shadow-md shadow-mint-500/30';
const navItemInactive = 'text-ink-800 font-medium hover:bg-mint-50';
const navItemDisabled = 'flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm mb-1 text-ink-600/50 cursor-not-allowed';

const sectionLabel = 'text-[11px] font-bold text-ink-600 mt-4 mb-1.5 uppercase tracking-wide font-mono';

export const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isStaff = user && ['staff', 'admin'].includes(user.role.toLowerCase());
  const isAdmin = user?.role.toLowerCase() === 'admin';
  const isBuyer = user?.role.toLowerCase() === 'corporate';

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Same animated background language as the landing/auth pages, everywhere
          in the app — kept in "lite" mode here since this shell also has to
          render data tables, forms and charts on top of it. */}
      <div className="circuit-bg" />
      <div className="absolute inset-0 z-0">
        <Hero3D density="lite" />
      </div>
      <div className="bg-blob blob-1" style={{ opacity: 0.18 }} />
      <div className="bg-blob blob-2" style={{ opacity: 0.18 }} />

      {/* Sidebar */}
      <motion.aside
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="glass relative z-10 w-64 flex-shrink-0 flex flex-col p-4 m-3 rounded-3xl"
        style={{ height: 'calc(100vh - 24px)' }}
      >
        <div className="flex items-center gap-3 mb-1 px-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 flex items-center justify-center text-white text-base shadow-md shadow-mint-500/30 flex-shrink-0">♻</div>
          <div>
            <h3 className="font-display font-bold text-sm leading-none">E-Waste<span className="text-mint-600">.</span></h3>
          </div>
        </div>
        <p className="text-[10px] text-ink-600 font-mono tracking-widest ml-1 mb-5">MANAGEMENT SYSTEM</p>

        <nav className="flex-1 overflow-y-auto pr-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>

          {isBuyer && (
            <>
              <div className={sectionLabel}>Buyer Portal</div>
              <NavLink to="/material-requests" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}>
                <ClipboardList size={16} /> Material Requests
              </NavLink>
            </>
          )}

          {/* Component A — Collection (not built yet) */}
          <div className={sectionLabel}>Component A — Collection</div>
          <div className={navItemDisabled} title="Built by another team member — coming soon">
            <span className="flex items-center gap-3"><Truck size={16} /> Collection</span>
            <Lock size={12} />
          </div>

          {/* Component B — Processing (not built yet) */}
          <div className={sectionLabel}>Component B — Processing</div>
          <div className={navItemDisabled} title="Built by another team member — coming soon">
            <span className="flex items-center gap-3"><Recycle size={16} /> Processing</span>
            <Lock size={12} />
          </div>

          {/* Component C — Submission */}
          <div className={sectionLabel}>Component C — Submission</div>
          <NavLink to="/submissions/new" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}>
            <Send size={16} /> Submit Item
          </NavLink>
          {isAdmin && (
            <NavLink to="/submissions/review" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}>
              <CheckSquare size={16} /> Submissions Review
            </NavLink>
          )}

          {/* Component D — Sales (my part) */}
          {isStaff && (
            <>
              <div className={sectionLabel}>Component D — Sales</div>
              <NavLink to="/materials" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><Package size={16} /> Recovered Materials</NavLink>
              <NavLink to="/pricing" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><Tag size={16} /> Pricing</NavLink>
              <NavLink to="/buyers" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><Users size={16} /> Buyers</NavLink>
              <NavLink to="/sales-orders" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><ShoppingCart size={16} /> Sales Orders</NavLink>
              <NavLink to="/export-orders" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><Ship size={16} /> Export Orders</NavLink>
              <NavLink to="/revenue" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><DollarSign size={16} /> Revenue</NavLink>
              <NavLink to="/plans" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><Bot size={16} /> AI Plans</NavLink>
              <NavLink to="/material-requests/manage" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}><ClipboardList size={16} /> Buyer Demand</NavLink>
            </>
          )}

          {isAdmin && (
            <>
              <div className={sectionLabel}>Admin</div>
              <NavLink to="/approvals" className={({ isActive }) => `${navItem} ${isActive ? navItemActive : navItemInactive}`}>
                <CheckSquare size={16} /> Commercial Approvals
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-mint-100 pt-3 mt-3">
          <div className="text-sm mb-2 px-1">
            <strong className="font-display">{user?.fullName}</strong>
            <div className="text-ink-600 text-xs capitalize font-mono">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="btn-glass-light w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </motion.aside>

      {/* Main content — fades between routes */}
      <main className="relative z-10 flex-1 p-6 overflow-y-auto" style={{ height: '100vh' }}>
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
      </main>
    </div>
  );
};

export default Layout;
