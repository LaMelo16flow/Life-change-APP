import { UserOverview } from './UserOverview';
import { MyTeam } from './MyTeam';
import { RankProgress } from './RankProgress';
import { PVHistory } from './PVHistory';
import { NotificationsList } from './NotificationsList';
import { Wallet } from './Wallet';
import { UserProfile } from './UserProfile';
import Shop from './Shop';
import Cart from './Cart';
import MyOrders from './MyOrders';

interface UserDashboardProps {
  activeTab: string;
}

export function UserDashboard({ activeTab }: UserDashboardProps) {
  return (
    <div>
      {activeTab === 'overview' && <UserOverview />}
      {activeTab === 'team' && <MyTeam />}
      {activeTab === 'rank' && <RankProgress />}
      {activeTab === 'pv' && <PVHistory />}
      {activeTab === 'notifications' && <NotificationsList />}
      {activeTab === 'wallet' && <Wallet />}
      {activeTab === 'shop' && <Shop />}
      {activeTab === 'cart' && <Cart />}
      {activeTab === 'orders' && <MyOrders />}
      {activeTab === 'profile' && <UserProfile />}
    </div>
  );
}
