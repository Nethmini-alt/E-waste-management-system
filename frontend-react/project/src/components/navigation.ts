import { matchPath } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, CheckSquare, Truck, PackagePlus, Boxes, PackageOpen, Users, ShoppingCart,
  Wallet, DollarSign, Tag, Cpu, UserCog, Send, PackageSearch, ClipboardList,
} from 'lucide-react';

/**
 * The whole app's navigation in one place. The sidebar shows one link per entry; when an entry
 * has more than one visible tab, a tab bar above the page switches between them. Pages and URLs
 * are unchanged, so every existing link and bookmark keeps working.
 */

const STAFF = ['staff', 'admin'];
const ADMIN = ['admin'];
const GENERATORS = ['household', 'corporate'];
const BUYER = ['corporate'];

export interface NavTab {
  label: string;
  to: string;
  /** Extra route patterns that also belong to this tab (e.g. a detail page). */
  match?: string[];
  /** Match the path exactly instead of as a prefix. */
  end?: boolean;
  roles?: string[];
}

export interface NavEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  tabs: NavTab[];
  /** Where the sidebar link goes; defaults to the first visible tab. */
  to?: string;
  roles?: string[];
}

export interface NavSection {
  id: string;
  /** No label = entries sit at the top of the sidebar with no header. */
  label?: string;
  entries: NavEntry[];
}

export const HOME_DASHBOARD_KEY = 'ewaste.homeDashboard';

// Ordered the way the work flows: waste comes in, is processed, is sold, then the money is settled.
const NAV: NavSection[] = [
  {
    id: 'home',
    entries: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        to: '/',
        tabs: [
          { label: 'Home', to: '/', end: true, roles: GENERATORS },
          { label: 'Processing overview', to: '/processing', end: true, roles: STAFF },
          { label: 'Sales overview', to: '/dashboard/sales', roles: STAFF },
        ],
      },
    ],
  },
  {
    id: 'submissions',
    label: 'Submissions',
    entries: [
      { id: 'submit', label: 'Submit Item', icon: Send, tabs: [{ label: 'Submit item', to: '/submissions/new' }], roles: GENERATORS },
      { id: 'mine', label: 'My Submissions', icon: PackageSearch, tabs: [{ label: 'My submissions', to: '/submissions/mine' }], roles: GENERATORS },
    ],
  },
  {
    id: 'buyer',
    label: 'Buyer Portal',
    entries: [
      { id: 'requests', label: 'Material Requests', icon: ClipboardList, tabs: [{ label: 'Material requests', to: '/material-requests', end: true }], roles: BUYER },
    ],
  },
  {
    id: 'intake',
    label: 'Intake',
    entries: [
      { id: 'review', label: 'Submissions Review', icon: CheckSquare, tabs: [{ label: 'Submissions review', to: '/submissions/review' }], roles: STAFF },
      {
        id: 'collection',
        label: 'Collection',
        icon: Truck,
        roles: STAFF,
        tabs: [
          { label: 'Jobs', to: '/collection/jobs' },
          { label: 'Collectors', to: '/collection/collectors' },
        ],
      },
      { id: 'receive', label: 'Receive Waste', icon: PackagePlus, tabs: [{ label: 'Receive waste', to: '/processing/receive' }], roles: STAFF },
    ],
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    entries: [
      { id: 'inventory', label: 'Inventory', icon: Boxes, tabs: [{ label: 'Inventory', to: '/processing/inventory' }], roles: STAFF },
      {
        id: 'materials',
        label: 'Materials',
        icon: PackageOpen,
        roles: STAFF,
        tabs: [
          { label: 'Material stock', to: '/processing/material-stock' },
          { label: 'Sellable materials', to: '/materials', end: true },
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    entries: [
      {
        id: 'buyers',
        label: 'Buyers',
        icon: Users,
        roles: STAFF,
        tabs: [
          { label: 'Buyers', to: '/buyers' },
          { label: 'Buyer demand', to: '/material-requests/manage' },
        ],
      },
      {
        id: 'orders',
        label: 'Orders',
        icon: ShoppingCart,
        roles: STAFF,
        tabs: [
          { label: 'Sales orders', to: '/sales-orders' },
          { label: 'Export orders', to: '/export-orders' },
        ],
      },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    entries: [
      { id: 'payments', label: 'Collector Payments', icon: Wallet, tabs: [{ label: 'Collector payments', to: '/processing/payments' }], roles: STAFF },
      { id: 'revenue', label: 'Revenue', icon: DollarSign, tabs: [{ label: 'Revenue', to: '/revenue' }], roles: STAFF },
      {
        id: 'prices',
        label: 'Prices & Rates',
        icon: Tag,
        roles: STAFF,
        tabs: [
          { label: 'Selling prices', to: '/pricing' },
          { label: 'Collector rates', to: '/processing/rate-policies' },
        ],
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI & Approvals',
    entries: [
      {
        id: 'ai-review',
        label: 'AI Reviews',
        icon: Cpu,
        roles: STAFF,
        tabs: [
          { label: 'Agentic review', to: '/processing/agentic-review' },
          { label: 'AI plans', to: '/plans' },
          { label: 'Commercial approvals', to: '/approvals', roles: ADMIN },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    entries: [
      {
        id: 'users',
        label: 'Users',
        icon: UserCog,
        roles: ADMIN,
        tabs: [
          { label: 'Staff', to: '/admin/staff' },
          { label: 'Admins', to: '/admin/admins' },
          { label: 'Staff work review', to: '/admin/staff-activity' },
        ],
      },
    ],
  },
];

const allowed = (roles: string[] | undefined, role: string) => !roles || roles.includes(role);

/** The sections, entries and tabs this role may see; empty ones are dropped. */
export const navFor = (role: string | undefined): NavSection[] => {
  const r = (role ?? '').toLowerCase();
  return NAV.map((section) => ({
    ...section,
    entries: section.entries
      .filter((e) => allowed(e.roles, r))
      .map((e) => ({ ...e, tabs: e.tabs.filter((t) => allowed(t.roles, r)) }))
      .filter((e) => e.tabs.length > 0),
  })).filter((s) => s.entries.length > 0);
};

export const tabMatches = (tab: NavTab, pathname: string) =>
  [tab.to, ...(tab.match ?? [])].some((path) => matchPath({ path, end: tab.end ?? false }, pathname) !== null);

export const entryLink = (entry: NavEntry) => entry.to ?? entry.tabs[0].to;

export const findActive = (sections: NavSection[], pathname: string) => {
  for (const section of sections) {
    for (const entry of section.entries) {
      const tab = entry.tabs.find((t) => tabMatches(t, pathname));
      if (tab) return { section, entry, tab };
    }
  }
  return null;
};
