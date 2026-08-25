import { MyTeam } from './MyTeam';
import { PVHistory } from './PVHistory';
import { NotificationsList } from './NotificationsList';
import { UserProfile } from './UserProfile';
import Shop from './Shop';
import Cart from './Cart';
import MyOrders from './MyOrders';

interface UserDashboardProps {
  activeTab: string;
}

export function UserDashboard({ activeTab }: UserDashboardProps) {
  if (activeTab === 'team') return <MyTeam />;
  if (activeTab === 'pv') return <PVHistory />;
  if (activeTab === 'notifications') return <NotificationsList />;
  if (activeTab === 'cart') return <Cart />;
  if (activeTab === 'orders') return <MyOrders />;
  if (activeTab === 'profile') return <UserProfile />;

  // Default landing tab - also covers a stale 'overview' value left over
  // from Dashboard's shared activeTab state (its initial value, still
  // valid for the admin side's own Overview tab).
  return <Shop />;
}
