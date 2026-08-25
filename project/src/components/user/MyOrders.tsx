import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { getLocalizedProductName } from '../../utils/productLocale';
import { ShoppingBag, Clock, Check, X, Package, Upload, CreditCard, ChevronDown, ChevronUp, Phone, Mail, Building2 } from 'lucide-react';
import { sendPaymentSubmittedNotification } from '../../utils/notifications';

interface CountryPaymentInfo {
  id: string;
  country_code: string;
  payment_method: string;
  payment_label: string;
  recipient_name: string;
  recipient_contact: string;
  payment_instructions: string;
  is_active: boolean;
  display_order: number;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  free_quantity: number;
  unit_price: number;
  subtotal: number;
  pv_value: number;
  product: {
    name: string;
    name_en?: string | null;
    image_url: string | null;
  };
}

interface Order {
  id: string;
  order_number: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency_code: string;
  region: string;
  status: 'pending' | 'approved' | 'awaiting_payment' | 'rejected' | 'completed' | 'cancelled';
  approved_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  admin_email: string | null;
  payment_screenshot_url: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  payment_notes: string | null;
  items_count: number | null;
  created_at: string;
  product: {
    name: string;
    name_en?: string | null;
    pv_value: number;
    image_url: string | null;
  } | null;
  order_items?: OrderItem[];
}

export default function MyOrders() {
  const { user } = useAuth();
  const toast = useToast();
  const { language, t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [countryPaymentInfos, setCountryPaymentInfos] = useState<CountryPaymentInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOrders();
    loadAdminSettings();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my-orders-live-updates-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          product:products(name, name_en, pv_value, image_url),
          order_items(
            id,
            product_id,
            quantity,
            free_quantity,
            unit_price,
            subtotal,
            pv_value,
            product:products(name, name_en, image_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminSettings = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('country_code')
        .eq('id', user!.id)
        .maybeSingle();

      const userCountry = profileData?.country_code || 'CA';

      const [emailSettings, instructionsSettings, countryPayments] = await Promise.all([
        supabase.from('admin_settings').select('value').eq('key', 'admin_contact_email').maybeSingle(),
        supabase.from('admin_settings').select('value').eq('key', 'payment_instructions').maybeSingle(),
        supabase.from('country_payment_info').select('*').eq('country_code', userCountry).eq('is_active', true).order('display_order'),
      ]);

      if (emailSettings?.data) {
        setAdminEmail(emailSettings.data.value?.email || 'admin@lifechangers.com');
      }
      if (instructionsSettings?.data) {
        setPaymentInstructions(instructionsSettings.data.value?.instructions || 'Please send e-transfer to the admin email provided.');
      }
      if (countryPayments?.data) {
        setCountryPaymentInfos(countryPayments.data);
      }
    } catch (error) {
      console.error('Error loading admin settings:', error);
    }
  };

  const getOrderDisplayInfo = (order: Order) => {
    if (order.order_items && order.order_items.length > 0) {
      const names = order.order_items.map(item => getLocalizedProductName(item.product, language));
      const displayName = names.length > 2
        ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
        : names.join(', ');
      const totalPV = order.order_items.reduce((sum, item) =>
        sum + (item.pv_value * (item.quantity + item.free_quantity)), 0);
      const firstImage = order.order_items[0]?.product?.image_url;
      return { displayName, totalPV, image: firstImage, itemCount: order.order_items.length };
    }

    return {
      displayName: order.product ? getLocalizedProductName(order.product, language) : t('common.unknownProduct'),
      totalPV: order.product ? order.product.pv_value * order.quantity : 0,
      image: order.product?.image_url,
      itemCount: 1
    };
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleSubmitPayment = async () => {
    if (!selectedOrder || !paymentScreenshot || !user) return;

    setUploadingPayment(true);

    try {
      const fileExt = paymentScreenshot.name.split('.').pop();
      const fileName = `${user.id}/${selectedOrder.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, paymentScreenshot);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_screenshot_url: fileName,
          payment_submitted_at: new Date().toISOString(),
          payment_notes: paymentNotes,
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert([{
        user_id: user.id,
        type: 'payment',
        title: t('orders.paymentProofSubmitted'),
        message: t('orders.paymentProofSubmittedMsg', { orderNumber: selectedOrder.order_number }),
        action_url: '/orders',
      }]);

      const adminEmailToUse = selectedOrder.admin_email || adminEmail;
      const { displayName } = getOrderDisplayInfo(selectedOrder);

      await sendPaymentSubmittedNotification(
        {
          orderNumber: selectedOrder.order_number,
          productName: displayName,
          quantity: selectedOrder.quantity,
          totalAmount: `${selectedOrder.currency_code} ${selectedOrder.total_amount.toFixed(2)}`,
          userName: user.user_metadata?.full_name || user.email || 'Customer',
          userEmail: user.email,
        },
        adminEmailToUse
      );

      toast.success(t('orders.paymentSubmittedToast'));
      setShowPaymentModal(false);
      setPaymentNotes('');
      setPaymentScreenshot(null);
      setSelectedOrder(null);
      loadOrders();
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error(t('orders.failedSubmitPayment'));
    } finally {
      setUploadingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: typeof Clock; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: t('orders.pending') },
      approved: { bg: 'bg-green-100', text: 'text-green-800', icon: Check, label: t('orders.statusApproved') },
      awaiting_payment: { bg: 'bg-orange-100', text: 'text-orange-800', icon: CreditCard, label: t('orders.awaitingPayment') },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: X, label: t('orders.rejected') },
      completed: { bg: 'bg-brand-100', text: 'text-brand-800', icon: Package, label: t('orders.completed') },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: X, label: t('orders.cancelled') },
    };
    return styles[status] || styles.pending;
  };

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(order => order.status === statusFilter);

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const awaitingPaymentCount = orders.filter(o => o.status === 'awaiting_payment').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64">{t('admin.loadingOrders')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600" />
          {t('orders.title')}
        </h2>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{t('orders.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-yellow-600 font-medium">{t('orders.pending')}</div>
              <div className="text-xl sm:text-2xl font-bold text-yellow-800">{pendingCount}</div>
            </div>
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-orange-600 font-medium">{t('orders.awaitingPayment')}</div>
              <div className="text-xl sm:text-2xl font-bold text-orange-800">{awaitingPaymentCount}</div>
            </div>
            <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-brand-600 font-medium">{t('orders.totalOrders')}</div>
              <div className="text-xl sm:text-2xl font-bold text-brand-800">{orders.length}</div>
            </div>
            <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 -mx-1 px-1">
        {[
          { value: 'all', label: t('orders.filterAll') },
          { value: 'pending', label: t('orders.pending') },
          { value: 'awaiting_payment', label: t('orders.filterAwaiting') },
          { value: 'completed', label: t('orders.completed') },
          { value: 'rejected', label: t('orders.rejected') },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
              statusFilter === value
                ? 'bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ShoppingBag size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            {statusFilter === 'all' ? t('orders.noOrders') : t('orders.noStatusOrders', { status: statusFilter })}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusStyle = getStatusBadge(order.status);
            const StatusIcon = statusStyle.icon;
            const { displayName, totalPV, image, itemCount } = getOrderDisplayInfo(order);
            const isExpanded = expandedOrders.has(order.id);

            return (
              <div
                key={order.id}
                className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {image && (
                    <div className="w-full sm:w-24 h-32 sm:h-24 flex-shrink-0">
                      <img
                        src={image}
                        alt={displayName}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}

                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">{displayName}</h3>
                        <p className="text-xs sm:text-sm text-gray-500">{t('orders.orderNumberLabel', { number: order.order_number })}</p>
                        {itemCount > 1 && (
                          <button
                            onClick={() => toggleOrderExpand(order.id)}
                            className="text-sm text-brand-600 font-medium flex items-center gap-1 mt-1 hover:text-brand-700"
                          >
                            <Package size={14} />
                            {t('orders.itemsCountLabel', { n: itemCount })}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text} flex items-center gap-1`}>
                        <StatusIcon size={14} />
                        {statusStyle.label}
                      </span>
                    </div>

                    {isExpanded && order.order_items && order.order_items.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        {order.order_items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3">
                            {item.product.image_url && (
                              <img
                                src={item.product.image_url}
                                alt={getLocalizedProductName(item.product, language)}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm">{getLocalizedProductName(item.product, language)}</p>
                              <p className="text-xs text-gray-600">
                                {t('orders.qtyLabel', { n: item.quantity })}{item.free_quantity > 0 && t('orders.freeSuffix', { n: item.free_quantity })}
                                <span className="mx-2">|</span>
                                {formatCurrency(item.unit_price)} {t('orders.each')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatCurrency(item.subtotal)}</p>
                              <p className="text-xs text-orange-600">{item.pv_value * (item.quantity + item.free_quantity)} PV</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <div className="text-gray-600">{t('orders.items')}</div>
                        <div className="font-medium text-gray-900">{itemCount}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">{t('orders.totalAmount')}</div>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(order.total_amount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">{t('orders.pvValue')}</div>
                        <div className="font-medium text-orange-600">{totalPV} PV</div>
                      </div>
                      <div>
                        <div className="text-gray-600">{t('orders.date')}</div>
                        <div className="font-medium text-gray-900">
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {order.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                        <div className="text-sm font-medium text-red-800 mb-1">{t('orders.rejectionReason')}</div>
                        <div className="text-sm text-red-700">{order.rejection_reason}</div>
                      </div>
                    )}

                    {order.admin_notes && order.status !== 'rejected' && (
                      <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mt-2">
                        <div className="text-sm font-medium text-brand-800 mb-1">{t('orders.adminNotes')}:</div>
                        <div className="text-sm text-brand-700">{order.admin_notes}</div>
                      </div>
                    )}

                    {order.status === 'pending' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                        <div className="text-sm text-yellow-800 flex items-center gap-2">
                          <Clock size={16} />
                          <span>{t('orders.pendingApprovalMsg')}</span>
                        </div>
                      </div>
                    )}

                    {order.status === 'awaiting_payment' && !order.payment_screenshot_url && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-2">
                        <div className="text-sm font-medium text-orange-800 mb-2 flex items-center gap-2">
                          <CreditCard size={16} />
                          {t('orders.awaitingPayment')}
                        </div>
                        <p className="text-sm text-orange-700 mb-2">
                          {t('orders.approvedReserveMsg')}
                        </p>
                        {countryPaymentInfos.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {countryPaymentInfos.map((info) => (
                              <div key={info.id} className="bg-white rounded-lg p-3 border border-orange-200">
                                <p className="text-xs text-gray-500 uppercase font-medium tracking-wide flex items-center gap-1">
                                  {info.payment_label}
                                </p>
                                {info.recipient_name && (
                                  <p className="text-sm text-gray-700 mt-1">{info.recipient_name}</p>
                                )}
                                <p className="text-lg font-bold text-brand-700 mt-0.5">{info.recipient_contact}</p>
                                {info.payment_instructions && (
                                  <p className="text-xs text-gray-500 mt-1">{info.payment_instructions}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">{t('orders.refOrderNumber', { number: order.order_number })}</p>
                              </div>
                            ))}
                          </div>
                        ) : order.admin_email ? (
                          <div className="bg-white rounded-lg p-3 mb-3 border border-orange-200">
                            <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">{t('orders.sendPaymentTo')}</p>
                            <p className="text-lg font-bold text-brand-700 mt-1">{order.admin_email}</p>
                            <p className="text-xs text-gray-500 mt-1">{t('orders.referenceOrderNumber', { number: order.order_number })}</p>
                          </div>
                        ) : null}
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowPaymentModal(true);
                          }}
                          className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition font-medium flex items-center justify-center gap-2"
                        >
                          <Upload size={18} />
                          {t('orders.submitPaymentProof')}
                        </button>
                      </div>
                    )}

                    {order.status === 'awaiting_payment' && order.payment_screenshot_url && (
                      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mt-2">
                        <div className="text-sm font-medium text-brand-800 mb-2">{t('orders.paymentProofSubmitted')}</div>
                        <p className="text-sm text-brand-700">
                          {t('orders.paymentBeingVerifiedMsg')}
                        </p>
                        {order.payment_submitted_at && (
                          <p className="text-xs text-brand-600 mt-1">
                            {t('orders.submittedOn', { date: new Date(order.payment_submitted_at).toLocaleString() })}
                          </p>
                        )}
                      </div>
                    )}

                    {order.status === 'completed' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                        <div className="text-sm font-medium text-green-800 mb-1 flex items-center gap-2">
                          <Package size={16} />
                          {t('orders.orderComplete')}
                        </div>
                        <p className="text-sm text-green-700">
                          {t('orders.paymentVerifiedMsg')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-bold mb-4">{t('orders.submitPaymentProof')}</h3>

            <div className="space-y-4">
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
                <h4 className="font-semibold text-brand-900 mb-2">{t('cart.orderSummary')}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-brand-700">{t('orders.orderNumberColon')}</span>
                    <span className="font-bold text-brand-900 ml-2">{selectedOrder.order_number}</span>
                  </div>
                  <div>
                    <span className="text-brand-700">{t('orders.itemsColon')}</span>
                    <span className="font-medium text-brand-900 ml-2">{getOrderDisplayInfo(selectedOrder).itemCount}</span>
                  </div>
                  <div>
                    <span className="text-brand-700">{t('shop.totalAmount')}:</span>
                    <span className="font-bold text-brand-900 ml-2">
                      {formatCurrency(selectedOrder.total_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-brand-700">{t('shop.totalPVLabel')}</span>
                    <span className="font-medium text-brand-900 ml-2">{getOrderDisplayInfo(selectedOrder).totalPV}</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">{t('orders.paymentInstructionsTitle')}</h4>
                <p className="text-sm text-yellow-800 mb-2">{paymentInstructions}</p>
                {countryPaymentInfos.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {countryPaymentInfos.map((info) => (
                      <div key={info.id} className="bg-white rounded-lg p-3 border border-yellow-200">
                        <div className="flex items-center gap-2 mb-1">
                          {info.payment_method.includes('mobile') || info.payment_method.includes('mtn') || info.payment_method.includes('orange') ? (
                            <Phone size={14} className="text-gray-500" />
                          ) : info.payment_method.includes('bank') || info.payment_method.includes('wire') ? (
                            <Building2 size={14} className="text-gray-500" />
                          ) : (
                            <Mail size={14} className="text-gray-500" />
                          )}
                          <span className="text-sm font-semibold text-gray-800">{info.payment_label}</span>
                        </div>
                        {info.recipient_name && (
                          <p className="text-sm text-gray-600">{info.recipient_name}</p>
                        )}
                        <p className="text-lg font-bold text-brand-600 mt-0.5">{info.recipient_contact}</p>
                        {info.payment_instructions && (
                          <p className="text-xs text-gray-500 mt-1">{info.payment_instructions}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {t('orders.referenceOrderNumber', { number: selectedOrder.order_number })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded p-2 mt-2">
                    <p className="text-sm font-medium text-gray-700">{t('orders.sendPaymentTo')}:</p>
                    <p className="text-lg font-bold text-brand-600">{selectedOrder.admin_email || adminEmail}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('orders.referenceOrderNumber', { number: selectedOrder.order_number })}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('orders.transactionDetailsLabel')}
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder={t('orders.transactionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('orders.paymentScreenshotLabel')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition"
                  >
                    <Upload size={20} className="text-gray-500" />
                    <span className="text-gray-700">
                      {paymentScreenshot ? t('orders.changeScreenshot') : t('orders.uploadScreenshot')}
                    </span>
                  </button>
                  {paymentScreenshot && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                      <Check size={16} className="text-green-600" />
                      <span className="text-sm text-green-700">{paymentScreenshot.name}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('orders.uploadScreenshotHint')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitPayment}
                disabled={!paymentScreenshot || uploadingPayment}
                className="flex-1 bg-brand-700 text-white py-3 rounded-lg hover:bg-brand-800 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    {t('common.uploading')}
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    {t('orders.submitPaymentProof')}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentNotes('');
                  setPaymentScreenshot(null);
                  setSelectedOrder(null);
                }}
                disabled={uploadingPayment}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
