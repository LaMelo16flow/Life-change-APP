import { PVHistory } from './PVHistory';
import { NotificationsList } from './NotificationsList';
import { UserProfile } from './UserProfile';
import Shop from './Shop';
import Cart from './Cart';
import MyOrders from './MyOrders';

interface UserDashboardProps {
  activeTab: string;
  onNavigate: (actionUrl: string | null | undefined) => void;
}

export function UserDashboard({ activeTab, onNavigate }: UserDashboardProps) {
  if (activeTab === 'pv') return <PVHistory />;
  if (activeTab === 'notifications') return <NotificationsList onNavigate={onNavigate} />;
  if (activeTab === 'cart') return <Cart />;
  if (activeTab === 'orders') return <MyOrders />;
  if (activeTab === 'profile') return <UserProfile />;

  // Default landing tab - also covers a stale 'overview' value left over
  // from Dashboard's shared activeTab state (its initial value, still
  // valid for the admin side's own Overview tab).
  return <Shop />;
}
