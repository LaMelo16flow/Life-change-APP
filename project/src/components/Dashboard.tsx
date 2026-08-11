import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LayoutDashboard, Users, Award, TrendingUp, Bell, LogOut, Menu, ShoppingCart, Shield, CircleUser as UserCircle, Package, ShoppingBag, UsersRound, Tag, Globe, Settings, CreditCard } from 'lucide-react';
import { UserDashboard } from './user/UserDashboard';
import { AdminDashboard } from './admin/AdminDashboard';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const { profile, signOut, isMaster, hasPermission, isAdminOrManager } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('admin');
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = isAdminOrManager;
  const showAdminView = isAdmin && viewMode === 'admin';
  const isMobile = screenSize === 'mobile';

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
        setSidebarOpen(false);
        setSidebarCollapsed(false);
      } else if (width < 1024) {
        setScreenSize('tablet');
        setSidebarOpen(true);
        setSidebarCollapsed(true);
      } else {
        setScreenSize('desktop');
        setSidebarOpen(true);
        setSidebarCollapsed(false);
      }
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const loadUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);

    const handleNotificationRead = () => loadUnread();
    window.addEventListener('notification-read', handleNotificationRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-read', handleNotificationRead);
    };
  }, [profile]);

  const userTabs = [
    { id: 'overview', label: t('nav.overview'), icon: LayoutDashboard },
    { id: 'shop', label: t('nav.shop'), icon: ShoppingCart },
    { id: 'cart', label: t('nav.cart'), icon: ShoppingBag },
    { id: 'orders', label: t('nav.orders'), icon: Package },
    { id: 'team', label: t('nav.team'), icon: Users },
    { id: 'pv', label: t('nav.pv'), icon: TrendingUp },
    { id: 'notifications', label: t('nav.notifications'), icon: Bell, badge: unreadCount },
    { id: 'profile', label: t('nav.profile'), icon: Settings },
  ];

  const allAdminTabs = [
    { id: 'overview', label: t('user.dashboard'), icon: LayoutDashboard, always: true },
    { id: 'team', label: t('nav.team'), icon: UsersRound, masterOnly: true },
    { id: 'users', label: t('nav.users'), icon: Users, permission: 'manage_users' as const },
    { id: 'accounts', label: t('nav.accounts'), icon: UserCircle, permission: 'manage_accounts' as const },
    { id: 'products', label: t('nav.products'), icon: Package, permission: 'manage_products' as const },
    { id: 'inventory', label: t('nav.inventory'), icon: TrendingUp, permission: 'manage_inventory' as const },
    { id: 'orders', label: t('nav.orderManagement'), icon: ShoppingBag, permission: 'manage_orders' as const },
    { id: 'promotions', label: t('nav.promotions'), icon: Award, permission: 'manage_promotions' as const },
    { id: 'deals', label: t('nav.deals'), icon: Tag, permission: 'manage_products' as const },
    { id: 'payment-settings', label: t('nav.paymentSettings'), icon: CreditCard, adminOnly: true },
    { id: 'notifications', label: t('nav.notifications'), icon: Bell, badge: unreadCount, always: true },
  ];

  const adminTabs = allAdminTabs.filter(tab => {
    if (tab.always) return true;
    if (tab.masterOnly) return isMaster;
    if (tab.adminOnly) return profile?.role === 'admin';
    if (tab.permission) return hasPermission(tab.permission);
    return true;
  });

  const tabs = showAdminView ? adminTabs : userTabs;

  const toggleView = () => {
    setViewMode(viewMode === 'admin' ? 'user' : 'admin');
    setActiveTab('overview');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (isMobile) setSidebarOpen(false);
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex h-screen overflow-hidden">
        <aside
          className={`${
            isMobile
              ? `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-out ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : `${sidebarWidth} transition-all duration-300 ease-out`
          } bg-brand-950 text-white flex-shrink-0 flex flex-col overflow-hidden`}
        >
          <div className={`${isMobile ? 'w-64' : sidebarWidth} flex flex-col h-full transition-all duration-300`}>
            <div className={`${sidebarCollapsed && !isMobile ? 'p-2' : 'p-4 pb-3'}`}>
              <div className={`flex items-center ${sidebarCollapsed && !isMobile ? 'justify-center' : 'gap-3'} mb-3`}>
                <img
                  src={`${import.meta.env.BASE_URL}logo.webp`}
                  alt="Life Changer Logo"
                  className={`${sidebarCollapsed && !isMobile ? 'w-10 h-10' : 'w-11 h-11'} rounded-lg object-contain transition-all duration-300`}
                />
                {(!sidebarCollapsed || isMobile) && (
                  <h1 className="text-base font-bold tracking-tight text-white whitespace-nowrap">Life Changer</h1>
                )}
              </div>
              {(!sidebarCollapsed || isMobile) && (
                <div className="bg-brand-900/60 rounded-lg p-2.5">
                  <p className="text-sm font-semibold text-brand-100 truncate">{profile?.full_name}</p>
                  <p className="text-xs text-brand-300 truncate">{profile?.email}</p>
                </div>
              )}
            </div>

            <nav className={`flex-1 ${sidebarCollapsed && !isMobile ? 'px-1.5' : 'px-2'} py-1 space-y-0.5 overflow-y-auto sidebar-scrollbar`}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    title={sidebarCollapsed && !isMobile ? tab.label : undefined}
                    className={`w-full flex items-center ${sidebarCollapsed && !isMobile ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50'
                        : 'text-brand-200 hover:bg-brand-900/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {(!sidebarCollapsed || isMobile) && (
                      <span className="truncate text-sm font-medium">{tab.label}</span>
                    )}
                    {(!sidebarCollapsed || isMobile) && 'badge' in tab && (tab as any).badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                        {(tab as any).badge}
                      </span>
                    )}
                    {sidebarCollapsed && !isMobile && 'badge' in tab && (tab as any).badge > 0 && (
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {(tab as any).badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className={`${sidebarCollapsed && !isMobile ? 'p-1.5' : 'p-2'} border-t border-brand-900/50`}>
              {isAdmin && (
                <button
                  onClick={toggleView}
                  title={sidebarCollapsed && !isMobile ? (viewMode === 'admin' ? t('nav.switchToUser') : t('nav.switchToAdmin')) : undefined}
                  className={`w-full flex items-center ${sidebarCollapsed && !isMobile ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 mb-0.5 text-brand-200 hover:bg-brand-900/60 hover:text-white rounded-lg transition-all duration-150`}
                >
                  {viewMode === 'admin' ? (
                    <>
                      <UserCircle className="w-5 h-5 flex-shrink-0" />
                      {(!sidebarCollapsed || isMobile) && (
                        <span className="truncate text-sm font-medium">{t('nav.switchToUser')}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 flex-shrink-0" />
                      {(!sidebarCollapsed || isMobile) && (
                        <span className="truncate text-sm font-medium">{t('nav.switchToAdmin')}</span>
                      )}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
                title={sidebarCollapsed && !isMobile ? (language === 'en' ? 'Francais' : 'English') : undefined}
                className={`w-full flex items-center ${sidebarCollapsed && !isMobile ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 mb-0.5 text-brand-200 hover:bg-brand-900/60 hover:text-white rounded-lg transition-all duration-150`}
              >
                <Globe className="w-5 h-5 flex-shrink-0" />
                {(!sidebarCollapsed || isMobile) && (
                  <span className="truncate text-sm font-medium">{language === 'en' ? 'Francais' : 'English'}</span>
                )}
              </button>
              <button
                onClick={handleSignOut}
                title={sidebarCollapsed && !isMobile ? t('nav.logout') : undefined}
                className={`w-full flex items-center ${sidebarCollapsed && !isMobile ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 text-brand-300 hover:bg-red-600/20 hover:text-red-300 rounded-lg transition-all duration-150`}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {(!sidebarCollapsed || isMobile) && (
                  <span className="truncate text-sm font-medium">{t('nav.logout')}</span>
                )}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-100 px-4 lg:px-6 h-16 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <Menu className="w-5 h-5 text-gray-500" />
              </button>

              <h2 className="text-base font-semibold text-gray-900 hidden sm:block">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  viewMode === 'admin'
                    ? 'bg-brand-100 text-brand-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {viewMode === 'admin' ? 'Admin' : 'User'}
                </span>
              )}
              <button
                onClick={() => handleTabClick('notifications')}
                className="relative p-2 hover:bg-gray-100 rounded-xl transition"
              >
                <Bell className="w-5 h-5 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">
                {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-50 main-scrollbar">
            {showAdminView ? (
              <AdminDashboard activeTab={activeTab} />
            ) : (
              <UserDashboard activeTab={activeTab} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
