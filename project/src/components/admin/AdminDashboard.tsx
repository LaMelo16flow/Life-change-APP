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
import ProductAnalytics from './ProductAnalytics';
import { NotificationsList } from '../user/NotificationsList';

interface AdminDashboardProps {
  activeTab: string;
  onNavigate: (actionUrl: string | null | undefined) => void;
}

export function AdminDashboard({ activeTab, onNavigate }: AdminDashboardProps) {
  return (
    <div>
      {activeTab === 'overview' && <AdminOverview />}
      {activeTab === 'team' && <ManagerManagement />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'accounts' && <AccountApprovals />}
      {activeTab === 'products' && <ProductManagement />}
      {activeTab === 'inventory' && <InventoryManagement />}
      {activeTab === 'orders' && <OrderManagement />}
      {activeTab === 'analytics' && <ProductAnalytics />}
      {activeTab === 'promotions' && <PromotionApprovals />}
      {activeTab === 'deals' && <ProductPromotions />}
      {activeTab === 'payment-settings' && <PaymentSettings />}
      {activeTab === 'notifications' && <NotificationsList onNavigate={onNavigate} />}
    </div>
  );
}
