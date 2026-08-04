import { AdminOverview } from './AdminOverview';
import { UserManagement } from './UserManagement';
import { ProductManagement } from './ProductManagement';
import { PromotionApprovals } from './PromotionApprovals';
import InventoryManagement from './InventoryManagement';
import OrderManagement from './OrderManagement';
import AccountApprovals from './AccountApprovals';
import ManagerManagement from './ManagerManagement';
import ProductPromotions from './ProductPromotions';
import PaymentSettings from './PaymentSettings';
import { NotificationsList } from '../user/NotificationsList';

interface AdminDashboardProps {
  activeTab: string;
}

export function AdminDashboard({ activeTab }: AdminDashboardProps) {
  return (
    <div>
      {activeTab === 'overview' && <AdminOverview />}
      {activeTab === 'team' && <ManagerManagement />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'accounts' && <AccountApprovals />}
      {activeTab === 'products' && <ProductManagement />}
      {activeTab === 'inventory' && <InventoryManagement />}
      {activeTab === 'orders' && <OrderManagement />}
      {activeTab === 'promotions' && <PromotionApprovals />}
      {activeTab === 'deals' && <ProductPromotions />}
      {activeTab === 'payment-settings' && <PaymentSettings />}
      {activeTab === 'notifications' && <NotificationsList />}
    </div>
  );
}
