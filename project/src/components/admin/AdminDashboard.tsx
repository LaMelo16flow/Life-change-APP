import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { NotificationsList } from '../user/NotificationsList';
import { SectionSkeleton } from '../SectionSkeleton';

// Each admin page is downloaded only when it is opened (and prefetched in the
// background right after an admin logs in, see prefetchAdminPages).
const loaders = {
  overview: () => import('./AdminOverview').then((m) => ({ default: m.AdminOverview })),
  team: () => import('./ManagerManagement'),
  users: () => import('./UserManagement').then((m) => ({ default: m.UserManagement })),
  accounts: () => import('./AccountApprovals'),
  products: () => import('./ProductManagement').then((m) => ({ default: m.ProductManagement })),
  inventory: () => import('./InventoryManagement'),
  orders: () => import('./OrderManagement'),
  analytics: () => import('./ProductAnalytics'),
  promotions: () => import('./PromotionApprovals').then((m) => ({ default: m.PromotionApprovals })),
};

const pages: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(
  Object.entries(loaders).map(([key, load]) => [key, lazy(load)]),
);

const skeletonFor: Record<string, 'table' | 'cards' | 'list'> = {
  overview: 'cards',
  analytics: 'cards',
  accounts: 'list',
  team: 'list',
  promotions: 'list',
};

/** Downloads every admin page while the browser is idle so tabs open instantly. */
export function prefetchAdminPages() {
  const run = () => Object.values(loaders).forEach((load) => load().catch(() => undefined));
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(run);
  else setTimeout(run, 1500);
}

interface AdminDashboardProps {
  activeTab: string;
  onNavigate: (actionUrl: string | null | undefined) => void;
}

export function AdminDashboard({ activeTab, onNavigate }: AdminDashboardProps) {
  if (activeTab === 'notifications') return <NotificationsList onNavigate={onNavigate} />;
  const Page = pages[activeTab];
  if (!Page) return null;
  return (
    <Suspense fallback={<SectionSkeleton variant={skeletonFor[activeTab] || 'table'} />}>
      <Page />
    </Suspense>
  );
}
