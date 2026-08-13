import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedProductName } from '../../utils/productLocale';
import { loadCountryNames, getCountryName } from '../../utils/countries';
import { ShoppingCart, Check, X, Search, Eye, CreditCard, RefreshCw, Package, Image as ImageIcon, History, ChevronDown, ChevronUp, Merge } from 'lucide-react';
import {
  sendOrderApprovedNotification,
  sendOrderRejectedNotification,
  sendPaymentVerifiedNotification,
} from '../../utils/notifications';
import { roundPVToMultiple } from '../../utils/pv';

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
  user_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency_code: string;
  region: string;
  status: 'pending' | 'approved' | 'awaiting_payment' | 'rejected' | 'completed' | 'cancelled';
  approved_by: string | null;
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
  updated_at: string;
  user: {
    full_name: string;
    email: string;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state_province: string | null;
    postal_code: string | null;
    country_code: string;
    profile_image_url: string | null;
  };
  product: {
    name: string;
    name_en?: string | null;
    pv_value: number;
    image_url: string | null;
  } | null;
  order_items?: OrderItem[];
}

export default function OrderManagement() {
  const toast = useToast();
  const { language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [countryNames, setCountryNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRejectPaymentModal, setShowRejectPaymentModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentRejectionReason, setPaymentRejectionReason] = useState('');
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [showUserHistoryModal, setShowUserHistoryModal] = useState(false);
  const [userHistoryOrders, setUserHistoryOrders] = useState<Order[]>([]);
  const [userHistoryName, setUserHistoryName] = useState('');
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);
  const [expandedHistoryOrder, setExpandedHistoryOrder] = useState<string | null>(null);
  const [otherPendingOrders, setOtherPendingOrders] = useState<Order[]>([]);
  const [selectedMergeOrderIds, setSelectedMergeOrderIds] = useState<Set<string>>(new Set());
  const [mergeLoading, setMergeLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const countries = await loadCountryNames();
      setCountryNames(countries);
      await loadOrders();
      await loadStatusCounts();
    };
    loadData();
  }, [statusFilter]);

  useEffect(() => {
    const updateChannel = supabase
      .channel('order-management-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        await loadOrders();
        await loadStatusCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, async () => {
        await loadOrders();
        await loadStatusCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(updateChannel);
    };
  }, []);

  const loadStatusCounts = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('status');
      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach(({ status }) => {
        counts[status] = (counts[status] || 0) + 1;
      });
      setStatusCounts(counts);
    } catch (error) {
      console.error('Error loading status counts:', error);
    }
  };

  const getCountryLabel = (code: string) => getCountryName(code, countryNames);

  const loadOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          user:profiles!orders_user_id_profile_fkey(
            full_name,
            email,
            phone,
            address_line1,
            address_line2,
            city,
            state_province,
            postal_code,
            country_code,
            profile_image_url
          ),
          product:products!product_id(name, name_en, pv_value, image_url),
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
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading orders:', error);
        throw error;
      }

      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserOrderHistory = async (userId: string, userName: string) => {
    setUserHistoryName(userName);
    setShowUserHistoryModal(true);
    setUserHistoryLoading(true);
    setExpandedHistoryOrder(null);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles!orders_user_id_profile_fkey(
            full_name, email, phone,
            address_line1, address_line2, city, state_province, postal_code,
            country_code, profile_image_url
          ),
          product:products!product_id(name, name_en, pv_value, image_url),
          order_items(
            id, product_id, quantity, free_quantity,
            unit_price, subtotal, pv_value,
            product:products(name, name_en, image_url)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserHistoryOrders(data || []);
    } catch (error) {
      console.error('Error loading user order history:', error);
      toast.error('Failed to load user order history');
    } finally {
      setUserHistoryLoading(false);
    }
  };

  const getOrderDisplayInfo = (order: Order) => {
    if (order.order_items && order.order_items.length > 0) {
      const names = order.order_items.map(item => getLocalizedProductName(item.product, language)).slice(0, 2);
      const remaining = order.order_items.length - 2;
      const displayName = remaining > 0
        ? `${names.join(', ')} +${remaining} more`
        : names.join(', ');
      const totalPV = order.order_items.reduce((sum, item) =>
        sum + (item.pv_value * (item.quantity + item.free_quantity)), 0);
      const firstImage = order.order_items[0]?.product?.image_url;
      return { displayName, totalPV, image: firstImage, itemCount: order.order_items.length };
    }

    return {
      displayName: (order.product && getLocalizedProductName(order.product, language)) || 'Unknown Product',
      totalPV: order.product ? order.product.pv_value * order.quantity : 0,
      image: order.product?.image_url,
      itemCount: 1
    };
  };

  const applyCrossOrderPromotions = async (order: Order) => {
    if (!order.order_items || order.order_items.length === 0) return;

    const now = new Date().toISOString();
    const { data: activePromos } = await supabase
      .from('product_promotions')
      .select('id, product_id, buy_quantity, free_quantity, country_code')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gt('ends_at', now);

    if (!activePromos || activePromos.length === 0) return;

    for (const item of order.order_items) {
      const promo = activePromos.find(
        (p) => p.product_id === item.product_id &&
          (!p.country_code || p.country_code === order.region)
      );
      if (!promo) continue;

      const { data: allUserOrderItems } = await supabase
        .from('order_items')
        .select('quantity, free_quantity, order_id, orders!inner(status, user_id)')
        .eq('product_id', item.product_id)
        .in('orders.status', ['pending', 'awaiting_payment'])
        .eq('orders.user_id', order.user_id);

      if (!allUserOrderItems || allUserOrderItems.length === 0) continue;

      const totalPaid = allUserOrderItems.reduce((sum, oi) => sum + oi.quantity, 0);
      const totalFreeAlready = allUserOrderItems.reduce((sum, oi) => sum + oi.free_quantity, 0);

      const sets = Math.floor(totalPaid / promo.buy_quantity);
      const totalFreeDeserved = sets * promo.free_quantity;
      const additionalFree = totalFreeDeserved - totalFreeAlready;

      if (additionalFree <= 0) continue;

      const { data: invData } = await supabase
        .from('product_inventory')
        .select('quantity, reserved_quantity')
        .eq('product_id', item.product_id)
        .eq('region', order.region)
        .maybeSingle();

      if (!invData) continue;
      const available = invData.quantity - invData.reserved_quantity;
      const freeToAdd = Math.min(additionalFree, available);
      if (freeToAdd <= 0) continue;

      await supabase
        .from('order_items')
        .update({
          free_quantity: item.free_quantity + freeToAdd,
          promotion_id: promo.id,
        })
        .eq('id', item.id);

      const newOrderQty = order.quantity + freeToAdd;
      await supabase
        .from('orders')
        .update({ quantity: newOrderQty })
        .eq('id', order.id);

      await supabase
        .from('product_inventory')
        .update({
          reserved_quantity: invData.reserved_quantity + freeToAdd,
        })
        .eq('product_id', item.product_id)
        .eq('region', order.region);

      await supabase.from('notifications').insert([{
        user_id: order.user_id,
        type: 'promotion',
        title: 'Promotion Applied!',
        message: `You qualified for a promotion on ${item.product.name}! ${freeToAdd} free item${freeToAdd > 1 ? 's' : ''} added to order ${order.order_number}.`,
        action_url: '/orders',
      }]);
    }
  };

  const handleApproveOrder = async () => {
    if (!selectedOrder) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserEmail = userData.user?.email;

      const { data: countryPaymentInfos } = await supabase
        .from('country_payment_info')
        .select('*')
        .eq('country_code', selectedOrder.region)
        .eq('is_active', true)
        .order('display_order');

      let adminEmail: string;
      if (countryPaymentInfos && countryPaymentInfos.length > 0) {
        adminEmail = countryPaymentInfos[0].recipient_contact;
      } else {
        const { data: adminSettings } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'admin_contact_email')
          .maybeSingle();
        adminEmail = adminSettings?.value?.email || currentUserEmail;
      }

      await applyCrossOrderPromotions(selectedOrder);

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'awaiting_payment',
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
          admin_notes: adminNotes,
          admin_email: adminEmail,
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      const { displayName } = getOrderDisplayInfo(selectedOrder);

      await supabase.from('notifications').insert([{
        user_id: selectedOrder.user_id,
        type: 'approval',
        title: 'Order Approved - Payment Required',
        message: `Your order ${selectedOrder.order_number} has been approved. Please send payment to ${adminEmail} and submit your payment proof.`,
        action_url: '/orders',
      }]);

      await sendOrderApprovedNotification(
        {
          orderNumber: selectedOrder.order_number,
          productName: displayName,
          quantity: selectedOrder.quantity,
          totalAmount: `${selectedOrder.currency_code} ${selectedOrder.total_amount.toFixed(2)}`,
          userName: selectedOrder.user.full_name,
          adminEmail: adminEmail,
        },
        selectedOrder.user.email,
        selectedOrder.user_id
      );

      toast.success('Order approved. Stock reserved. User has been notified to submit payment.');
      setShowApproveModal(false);
      setAdminNotes('');
      setSelectedOrder(null);
      setOtherPendingOrders([]);
      setSelectedMergeOrderIds(new Set());
      await loadOrders();
      await loadStatusCounts();
    } catch (error) {
      console.error('Error approving order:', error);
      toast.error('Failed to approve order');
    }
  };

  const handleMergeAndApprove = async () => {
    if (!selectedOrder || selectedMergeOrderIds.size === 0) return;
    setMergeLoading(true);

    try {
      const ordersToMerge = otherPendingOrders.filter(o => selectedMergeOrderIds.has(o.id));

      let additionalAmount = 0;
      let additionalQuantity = 0;
      const allNewItems: Array<{
        order_id: string;
        product_id: string;
        quantity: number;
        free_quantity: number;
        unit_price: number;
        subtotal: number;
        pv_value: number;
        promotion_id?: string | null;
      }> = [];
      const mergedOrderNumbers: string[] = [];

      for (const mergeOrder of ordersToMerge) {
        additionalAmount += mergeOrder.total_amount;
        mergedOrderNumbers.push(mergeOrder.order_number);

        if (mergeOrder.order_items && mergeOrder.order_items.length > 0) {
          for (const item of mergeOrder.order_items) {
            additionalQuantity += item.quantity + item.free_quantity;
            allNewItems.push({
              order_id: selectedOrder.id,
              product_id: item.product_id,
              quantity: item.quantity,
              free_quantity: item.free_quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              pv_value: item.pv_value,
            });
          }
        } else {
          additionalQuantity += mergeOrder.quantity;
          if (mergeOrder.product_id) {
            allNewItems.push({
              order_id: selectedOrder.id,
              product_id: mergeOrder.product_id,
              quantity: mergeOrder.quantity,
              free_quantity: 0,
              unit_price: mergeOrder.unit_price,
              subtotal: mergeOrder.total_amount,
              pv_value: mergeOrder.product?.pv_value || 0,
            });
          }
        }
      }

      for (const mergeOrder of ordersToMerge) {
        if (mergeOrder.order_items && mergeOrder.order_items.length > 0) {
          await supabase
            .from('order_items')
            .delete()
            .eq('order_id', mergeOrder.id);
        }
      }

      if (allNewItems.length > 0) {
        const { error: insertError } = await supabase
          .from('order_items')
          .insert(allNewItems);
        if (insertError) throw insertError;
      }

      const newTotalAmount = selectedOrder.total_amount + additionalAmount;
      const newQuantity = selectedOrder.quantity + additionalQuantity;

      const allItemsCount = (selectedOrder.order_items?.length || 1) + allNewItems.length;

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotalAmount,
          quantity: newQuantity,
          items_count: allItemsCount,
          product_id: null,
          unit_price: 0,
          admin_notes: `Merged with orders: ${mergedOrderNumbers.join(', ')}${adminNotes ? `\n${adminNotes}` : ''}`,
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      for (const mergeOrder of ordersToMerge) {
        await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            admin_notes: `Merged into order ${selectedOrder.order_number}`,
          })
          .eq('id', mergeOrder.id);
      }

      const updatedOrder: Order = {
        ...selectedOrder,
        total_amount: newTotalAmount,
        quantity: newQuantity,
        items_count: allItemsCount,
        product_id: null,
        unit_price: 0,
      };

      const { data: freshItems } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, free_quantity, unit_price, subtotal, pv_value, product:products(name, name_en, image_url)')
        .eq('order_id', selectedOrder.id);

      if (freshItems) {
        updatedOrder.order_items = freshItems.map((item) => ({
          ...item,
          product: Array.isArray(item.product) ? item.product[0] : item.product,
        })) as OrderItem[];
      }

      setSelectedOrder(updatedOrder);
      setOtherPendingOrders([]);
      setSelectedMergeOrderIds(new Set());

      toast.success(`${ordersToMerge.length} order${ordersToMerge.length > 1 ? 's' : ''} merged into ${selectedOrder.order_number}. Now approving...`);

      setTimeout(() => handleApproveOrder(), 100);
    } catch (error) {
      console.error('Error merging orders:', error);
      toast.error('Failed to merge orders');
    } finally {
      setMergeLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder || !rejectionReason.trim()) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { displayName } = getOrderDisplayInfo(selectedOrder);

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'rejected',
          approved_by: userData.user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          admin_notes: adminNotes,
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      await supabase.from('notifications').insert([{
        user_id: selectedOrder.user_id,
        type: 'approval',
        title: 'Order Rejected',
        message: `Your order ${selectedOrder.order_number} has been rejected. Reason: ${rejectionReason}`,
        action_url: '/orders',
      }]);

      await sendOrderRejectedNotification(
        {
          orderNumber: selectedOrder.order_number,
          productName: displayName,
          quantity: selectedOrder.quantity,
          totalAmount: `${selectedOrder.currency_code} ${selectedOrder.total_amount.toFixed(2)}`,
          userName: selectedOrder.user.full_name,
        },
        selectedOrder.user.email,
        rejectionReason,
        selectedOrder.user_id
      );

      toast.success('Order rejected. User has been notified.');
      setShowRejectModal(false);
      setAdminNotes('');
      setRejectionReason('');
      setSelectedOrder(null);
      await loadOrders();
      await loadStatusCounts();
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast.error('Failed to reject order');
    }
  };

  const handleVerifyPayment = async () => {
    if (!selectedOrder) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { displayName, totalPV: orderPV } = getOrderDisplayInfo(selectedOrder);

      if (selectedOrder.order_items && selectedOrder.order_items.length > 0) {
        for (const item of selectedOrder.order_items) {
          const totalQuantity = item.quantity + item.free_quantity;
          const { data: inventoryData } = await supabase
            .from('product_inventory')
            .select('quantity, reserved_quantity')
            .eq('product_id', item.product_id)
            .eq('region', selectedOrder.region)
            .maybeSingle();

          if (inventoryData) {
            await supabase
              .from('product_inventory')
              .update({
                quantity: Math.max(0, (inventoryData.quantity || 0) - totalQuantity),
                reserved_quantity: Math.max(0, (inventoryData.reserved_quantity || 0) - totalQuantity),
              })
              .eq('product_id', item.product_id)
              .eq('region', selectedOrder.region);
          }
        }
      } else if (selectedOrder.product_id) {
        const { data: inventoryData } = await supabase
          .from('product_inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', selectedOrder.product_id)
          .eq('region', selectedOrder.region)
          .maybeSingle();

        if (inventoryData) {
          await supabase
            .from('product_inventory')
            .update({
              quantity: Math.max(0, (inventoryData.quantity || 0) - selectedOrder.quantity),
              reserved_quantity: Math.max(0, (inventoryData.reserved_quantity || 0) - selectedOrder.quantity),
            })
            .eq('product_id', selectedOrder.product_id)
            .eq('region', selectedOrder.region);
        }
      }

      const roundedPV = roundPVToMultiple(orderPV);

      await supabase.from('pv_transactions').insert([{
        user_id: selectedOrder.user_id,
        amount: roundedPV,
        transaction_type: 'purchase',
        reference_id: selectedOrder.id,
        reference_type: 'product',
        description: `Product purchase: ${displayName} (Raw PV: ${orderPV}, Rounded: ${roundedPV})`,
        created_by: userData.user?.id,
      }]);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('total_pv')
        .eq('id', selectedOrder.user_id)
        .maybeSingle();

      if (profileData) {
        await supabase
          .from('profiles')
          .update({ total_pv: (profileData.total_pv || 0) + roundedPV })
          .eq('id', selectedOrder.user_id);
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_verified_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      await supabase.from('notifications').insert([{
        user_id: selectedOrder.user_id,
        type: 'payment',
        title: 'Payment Verified - Order Complete!',
        message: `Your payment for order ${selectedOrder.order_number} has been verified. You earned ${roundedPV} PV!`,
        action_url: '/orders',
      }]);

      await sendPaymentVerifiedNotification(
        {
          orderNumber: selectedOrder.order_number,
          productName: displayName,
          quantity: selectedOrder.quantity,
          totalAmount: `${selectedOrder.currency_code} ${selectedOrder.total_amount.toFixed(2)}`,
          userName: selectedOrder.user.full_name,
        },
        selectedOrder.user.email,
        selectedOrder.user_id
      );

      toast.success('Payment verified and order completed! User has been notified.');
      setShowPaymentModal(false);
      setSelectedOrder(null);
      await loadOrders();
      await loadStatusCounts();
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast.error('Failed to verify payment');
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedOrder || !paymentRejectionReason.trim()) return;

    try {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'awaiting_payment',
          payment_screenshot_url: null,
          payment_submitted_at: null,
          admin_notes: `Payment rejected: ${paymentRejectionReason}`,
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      await supabase.from('notifications').insert([{
        user_id: selectedOrder.user_id,
        type: 'payment',
        title: 'Payment Proof Rejected',
        message: `Your payment proof for order ${selectedOrder.order_number} was rejected. Reason: ${paymentRejectionReason}. Please submit a new payment proof.`,
        action_url: '/orders',
      }]);

      toast.success('Payment proof rejected. User has been notified to resubmit.');
      setShowRejectPaymentModal(false);
      setPaymentRejectionReason('');
      setSelectedOrder(null);
      await loadOrders();
      await loadStatusCounts();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment');
    }
  };

  const handleStatusChange = async () => {
    if (!selectedOrder || !newStatus) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      await supabase.from('notifications').insert([{
        user_id: selectedOrder.user_id,
        type: 'approval',
        title: 'Order Status Updated',
        message: `Your order ${selectedOrder.order_number} status has been changed to: ${getStatusLabel(newStatus)}.`,
        action_url: '/orders',
      }]);

      toast.success(`Order status changed to "${getStatusLabel(newStatus)}".`);
      setShowStatusChangeModal(false);
      setNewStatus('');
      setSelectedOrder(null);
      await loadOrders();
      await loadStatusCounts();
    } catch (error) {
      console.error('Error changing order status:', error);
      toast.error('Failed to change status');
    }
  };

  const filteredOrders = orders.filter(order => {
    const { displayName } = getOrderDisplayInfo(order);
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      awaiting_payment: 'bg-orange-100 text-orange-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-brand-100 text-brand-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return styles[status] || styles.pending;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved',
      awaiting_payment: 'Awaiting Payment',
      rejected: 'Rejected',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
        <p className="text-gray-600">Review and approve customer orders</p>
      </div>

      {statusFilter !== 'awaiting_payment' && (statusCounts.awaiting_payment || 0) > 0 && (
        <button
          onClick={() => setStatusFilter('awaiting_payment')}
          className="w-full flex items-center justify-between gap-3 bg-orange-50 border border-orange-300 rounded-xl p-4 text-left hover:bg-orange-100 transition"
        >
          <div className="flex items-center gap-3">
            <ImageIcon className="text-orange-600 flex-shrink-0" size={20} />
            <p className="text-sm text-orange-900">
              <strong>{statusCounts.awaiting_payment}</strong> order{statusCounts.awaiting_payment === 1 ? '' : 's'} awaiting payment confirmation
              {statusFilter === 'pending' && ' (not shown in the current "Pending" filter)'}.
            </p>
          </div>
          <span className="text-sm font-semibold text-orange-700 flex-shrink-0">View &rarr;</span>
        </button>
      )}

      <div className="bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-200 rounded-xl p-6">
        <h3 className="font-bold text-brand-900 mb-3 text-lg">Order Processing Workflow</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold mb-2">1</div>
            <h4 className="font-semibold text-gray-900 mb-1">Pending</h4>
            <p className="text-sm text-gray-600">User submits order. Review stock and approve/reject.</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold mb-2">2</div>
            <h4 className="font-semibold text-gray-900 mb-1">Awaiting Payment</h4>
            <p className="text-sm text-gray-600">Stock reserved. User sends payment to admin email.</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold mb-2">3</div>
            <h4 className="font-semibold text-gray-900 mb-1">Payment Submitted</h4>
            <p className="text-sm text-gray-600">Verify payment proof. Confirm or reject.</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="w-8 h-8 bg-brand-800 text-white rounded-full flex items-center justify-center font-bold mb-2">4</div>
            <h4 className="font-semibold text-gray-900 mb-1">Completed</h4>
            <p className="text-sm text-gray-600">Payment verified. PVs allocated to user.</p>
          </div>
        </div>
        <p className="text-sm text-brand-800 mt-4 bg-white/50 rounded-lg p-3">
          <strong>Important:</strong> Approving an order reserves stock and sends your email as the payment address. PVs are ONLY allocated when you verify payment.
        </p>
      </div>

      {orders.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <ShoppingCart className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h3 className="font-semibold text-blue-900 mb-2">No Orders Found</h3>
          <p className="text-sm text-blue-700">
            {statusFilter === 'pending' ? 'No pending orders at the moment.' :
             statusFilter === 'awaiting_payment' ? 'No orders awaiting payment.' :
             statusFilter === 'completed' ? 'No completed orders yet.' :
             'No orders in the system yet. Orders will appear here once users start shopping.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="all">All Status ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})</option>
          <option value="pending">Pending ({statusCounts.pending || 0})</option>
          <option value="awaiting_payment">Awaiting Payment ({statusCounts.awaiting_payment || 0})</option>
          <option value="rejected">Rejected ({statusCounts.rejected || 0})</option>
          <option value="completed">Completed ({statusCounts.completed || 0})</option>
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ShoppingCart size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No orders found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Products
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const { displayName, image, itemCount } = getOrderDisplayInfo(order);
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => loadUserOrderHistory(order.user_id, order.user.full_name)}
                        className="flex items-center gap-3 group text-left"
                        title="View all orders from this user"
                      >
                        {order.user.profile_image_url ? (
                          <img
                            src={order.user.profile_image_url}
                            alt={order.user.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 group-hover:ring-2 group-hover:ring-brand-400 transition"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold group-hover:ring-2 group-hover:ring-brand-400 transition">
                            {order.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 group-hover:text-brand-700 transition flex items-center gap-1">
                            {order.user.full_name}
                            <History className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="text-sm text-gray-500">{order.user.email}</div>
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {image && (
                          <img
                            src={image}
                            alt={displayName}
                            className="w-10 h-10 rounded object-cover mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm text-gray-900 max-w-[200px] truncate">{displayName}</div>
                          {itemCount > 1 && (
                            <div className="text-xs text-brand-600 font-medium flex items-center gap-1">
                              <Package size={12} />
                              {itemCount} items
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.currency_code} {order.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadge(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                        {order.status === 'awaiting_payment' && order.payment_screenshot_url && (
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700 flex items-center gap-1">
                            <ImageIcon size={12} />
                            Proof
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetailsModal(true);
                        }}
                        className="text-brand-600 hover:text-brand-900 inline-flex items-center gap-1"
                      >
                        <Eye size={16} />
                        View
                      </button>
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={async () => {
                              setSelectedOrder(order);
                              setSelectedMergeOrderIds(new Set());
                              setShowApproveModal(true);
                              const others = orders.filter(
                                o => o.user_id === order.user_id
                                  && o.id !== order.id
                                  && o.status === 'pending'
                                  && o.region === order.region
                              );
                              if (others.length === 0) {
                                const { data } = await supabase
                                  .from('orders')
                                  .select(`
                                    *,
                                    user:profiles!orders_user_id_profile_fkey(
                                      full_name, email, phone,
                                      address_line1, address_line2, city, state_province, postal_code,
                                      country_code, profile_image_url
                                    ),
                                    product:products!product_id(name, name_en, pv_value, image_url),
                                    order_items(
                                      id, product_id, quantity, free_quantity,
                                      unit_price, subtotal, pv_value,
                                      product:products(name, name_en, image_url)
                                    )
                                  `)
                                  .eq('user_id', order.user_id)
                                  .eq('status', 'pending')
                                  .eq('region', order.region)
                                  .neq('id', order.id)
                                  .order('created_at', { ascending: false });
                                setOtherPendingOrders(data || []);
                              } else {
                                setOtherPendingOrders(others);
                              }
                            }}
                            className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                          >
                            <Check size={16} />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowRejectModal(true);
                            }}
                            className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                          >
                            <X size={16} />
                            Reject
                          </button>
                        </>
                      )}
                      {order.status === 'awaiting_payment' && order.payment_screenshot_url && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowPaymentModal(true);
                            }}
                            className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                          >
                            <CreditCard size={16} />
                            Verify
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowRejectPaymentModal(true);
                            }}
                            className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                          >
                            <X size={16} />
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setNewStatus(order.status);
                          setShowStatusChangeModal(true);
                        }}
                        className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
                        title="Change Status"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Order Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Order Number</label>
                  <p className="text-gray-900">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadge(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Customer</label>
                  <div className="flex items-center gap-3 mt-1">
                    {selectedOrder.user.profile_image_url ? (
                      <img
                        src={selectedOrder.user.profile_image_url}
                        alt={selectedOrder.user.full_name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold">
                        {selectedOrder.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-gray-900 font-medium truncate">{selectedOrder.user.full_name}</p>
                      <p className="text-sm text-gray-500 truncate">{selectedOrder.user.email}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Country</label>
                  <p className="text-gray-900">{getCountryLabel(selectedOrder.region)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h4>
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOrder.order_items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        {item.product.image_url && (
                          <img
                            src={item.product.image_url}
                            alt={getLocalizedProductName(item.product, language)}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{getLocalizedProductName(item.product, language)}</p>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span>Qty: {item.quantity}{item.free_quantity > 0 && ` (+${item.free_quantity} free)`}</span>
                            <span>@ {selectedOrder.currency_code} {item.unit_price.toFixed(2)}</span>
                            <span className="text-orange-600">{item.pv_value * (item.quantity + item.free_quantity)} PV</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{selectedOrder.currency_code} {item.subtotal.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : selectedOrder.product ? (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    {selectedOrder.product.image_url && (
                      <img
                        src={selectedOrder.product.image_url}
                        alt={getLocalizedProductName(selectedOrder.product, language)}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{getLocalizedProductName(selectedOrder.product, language)}</p>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>Qty: {selectedOrder.quantity}</span>
                        <span>@ {selectedOrder.currency_code} {selectedOrder.unit_price.toFixed(2)}</span>
                        <span className="text-orange-600">{selectedOrder.product.pv_value * selectedOrder.quantity} PV</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{selectedOrder.currency_code} {selectedOrder.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 pt-4 border-t flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>{selectedOrder.currency_code} {selectedOrder.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-orange-600">
                  <span>Total PV</span>
                  <span>{getOrderDisplayInfo(selectedOrder).totalPV} PV</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Order Date</label>
                <p className="text-gray-900">{new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Delivery Address</h4>
                {selectedOrder.user.address_line1 ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900 font-medium">{selectedOrder.user.full_name}</p>
                    {selectedOrder.user.phone && (
                      <p className="text-gray-700 text-sm">{selectedOrder.user.phone}</p>
                    )}
                    <p className="text-gray-700 mt-2">{selectedOrder.user.address_line1}</p>
                    {selectedOrder.user.address_line2 && (
                      <p className="text-gray-700">{selectedOrder.user.address_line2}</p>
                    )}
                    <p className="text-gray-700">
                      {selectedOrder.user.city}, {selectedOrder.user.state_province} {selectedOrder.user.postal_code}
                    </p>
                    <p className="text-gray-700">{getCountryLabel(selectedOrder.user.country_code)}</p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 text-sm">
                      <strong>Warning:</strong> Customer has not provided a delivery address yet.
                      Please contact them to update their profile before shipping.
                    </p>
                  </div>
                )}
              </div>

              {selectedOrder.payment_screenshot_url && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Payment Proof</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <a
                          href={selectedOrder.payment_screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={selectedOrder.payment_screenshot_url}
                            alt="Payment proof"
                            className="max-w-full h-auto max-h-[50vh] sm:max-h-[300px] rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition mx-auto"
                          />
                        </a>
                        <p className="text-xs text-gray-500 mt-2">Click image to view full size</p>
                      </div>
                    </div>
                    {selectedOrder.payment_submitted_at && (
                      <p className="text-sm text-green-700 mt-3">
                        Submitted: {new Date(selectedOrder.payment_submitted_at).toLocaleString()}
                      </p>
                    )}
                    {selectedOrder.payment_notes && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <label className="text-sm font-medium text-green-800">Customer Notes:</label>
                        <p className="text-sm text-green-700 mt-1">{selectedOrder.payment_notes}</p>
                      </div>
                    )}
                    {selectedOrder.payment_verified_at && (
                      <p className="text-sm text-green-700 mt-2">
                        Verified: {new Date(selectedOrder.payment_verified_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.admin_notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Admin Notes</label>
                  <p className="text-gray-900 mt-1">{selectedOrder.admin_notes}</p>
                </div>
              )}
              {selectedOrder.rejection_reason && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Rejection Reason</label>
                  <p className="text-red-600 mt-1">{selectedOrder.rejection_reason}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproveModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-1">Approve Order</h3>
            <p className="text-gray-600 mb-4">
              Order <strong>{selectedOrder.order_number}</strong> from <strong>{selectedOrder.user.full_name}</strong>
              {' '}({selectedOrder.currency_code} {selectedOrder.total_amount.toFixed(2)})
            </p>

            {otherPendingOrders.length > 0 && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Merge className="w-5 h-5 text-amber-700" />
                  <h4 className="font-semibold text-amber-900">
                    {otherPendingOrders.length} other pending order{otherPendingOrders.length > 1 ? 's' : ''} from this user
                  </h4>
                </div>
                <p className="text-sm text-amber-800 mb-3">
                  Select orders below to merge them into a single combined order before approving.
                </p>

                <div className="space-y-2">
                  {otherPendingOrders.map((o) => {
                    const { displayName, totalPV, itemCount } = getOrderDisplayInfo(o);
                    const isSelected = selectedMergeOrderIds.has(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-100 border-amber-400'
                            : 'bg-white border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedMergeOrderIds);
                            if (isSelected) next.delete(o.id);
                            else next.add(o.id);
                            setSelectedMergeOrderIds(next);
                          }}
                          className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{o.order_number}</span>
                            {itemCount > 1 && (
                              <span className="text-xs text-brand-600 font-medium flex items-center gap-0.5">
                                <Package size={10} /> {itemCount} items
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{displayName}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">{o.currency_code} {o.total_amount.toFixed(2)}</p>
                          <p className="text-xs text-orange-600">{totalPV} PV</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {selectedMergeOrderIds.size > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-900 font-medium">Combined total after merge:</span>
                      <span className="font-bold text-gray-900">
                        {selectedOrder.currency_code}{' '}
                        {(
                          selectedOrder.total_amount +
                          otherPendingOrders
                            .filter(o => selectedMergeOrderIds.has(o.id))
                            .reduce((sum, o) => sum + o.total_amount, 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    const all = new Set(otherPendingOrders.map(o => o.id));
                    setSelectedMergeOrderIds(
                      selectedMergeOrderIds.size === otherPendingOrders.length ? new Set() : all
                    );
                  }}
                  className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium underline"
                >
                  {selectedMergeOrderIds.size === otherPendingOrders.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes (Optional)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Add any notes about this approval..."
              />
            </div>
            <div className="flex gap-3">
              {selectedMergeOrderIds.size > 0 ? (
                <button
                  onClick={handleMergeAndApprove}
                  disabled={mergeLoading}
                  className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg hover:bg-amber-700 font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {mergeLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Merge size={18} />
                  )}
                  Merge ({selectedMergeOrderIds.size + 1} orders) & Approve
                </button>
              ) : (
                <button
                  onClick={handleApproveOrder}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-medium"
                >
                  Approve This Order Only
                </button>
              )}
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setAdminNotes('');
                  setOtherPendingOrders([]);
                  setSelectedMergeOrderIds(new Set());
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Reject Order</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting order <strong>{selectedOrder.order_number}</strong>:
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason*</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Explain why this order is being rejected..."
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes (Optional)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Add any internal notes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRejectOrder}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setAdminNotes('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Verify Payment</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-700">Order Number</label>
                  <p className="text-gray-900">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Customer</label>
                  <p className="text-gray-900">{selectedOrder.user.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="text-gray-900 font-bold">{selectedOrder.currency_code} {selectedOrder.total_amount.toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">PV Value</label>
                  <p className="text-gray-900">{getOrderDisplayInfo(selectedOrder).totalPV} PV</p>
                </div>
              </div>

              {selectedOrder.payment_notes && (
                <div className="p-4 bg-brand-50 rounded-lg">
                  <label className="text-sm font-medium text-brand-900">Payment Notes from Customer</label>
                  <p className="text-brand-800 mt-1">{selectedOrder.payment_notes}</p>
                </div>
              )}

              {selectedOrder.payment_screenshot_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Screenshot</label>
                  <div className="border-2 border-gray-300 rounded-lg p-2 bg-gray-50">
                    <img
                      src={selectedOrder.payment_screenshot_url}
                      alt="Payment Proof"
                      className="max-w-full h-auto max-h-[60vh] mx-auto rounded cursor-pointer hover:opacity-90 transition"
                      onClick={() => window.open(selectedOrder.payment_screenshot_url!, '_blank')}
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">Click image to view full size</p>
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Please verify that the payment amount matches the order total and that the payment has been received before confirming.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={handleVerifyPayment}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Verify Payment & Complete Order
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedOrder(null);
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Reject Payment Proof</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting the payment proof for order <strong>{selectedOrder.order_number}</strong>:
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason*</label>
              <textarea
                value={paymentRejectionReason}
                onChange={(e) => setPaymentRejectionReason(e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Example: Payment screenshot is unclear, amount doesn't match, payment not received..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRejectPayment}
                disabled={!paymentRejectionReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Reject Payment Proof
              </button>
              <button
                onClick={() => {
                  setShowRejectPaymentModal(false);
                  setPaymentRejectionReason('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusChangeModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">Change Order Status</h3>
            <p className="text-sm text-gray-600 mb-4">
              Order <strong>{selectedOrder.order_number}</strong>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Status</label>
              <span className={`px-3 py-1 text-sm font-semibold rounded ${getStatusBadge(selectedOrder.status)}`}>
                {getStatusLabel(selectedOrder.status)}
              </span>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {['pending', 'awaiting_payment', 'rejected', 'completed', 'cancelled'].map(status => (
                  <option key={status} value={status}>{getStatusLabel(status)}</option>
                ))}
              </select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Manually changing status will not trigger stock or PV adjustments. Use the normal approve/verify workflow for those.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStatusChange}
                disabled={newStatus === selectedOrder.status}
                className="flex-1 bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Update Status
              </button>
              <button
                onClick={() => {
                  setShowStatusChangeModal(false);
                  setNewStatus('');
                  setSelectedOrder(null);
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showUserHistoryModal && (
        <UserOrderHistoryModal
          userName={userHistoryName}
          orders={userHistoryOrders}
          loading={userHistoryLoading}
          expandedOrder={expandedHistoryOrder}
          onToggleExpand={(id) => setExpandedHistoryOrder(expandedHistoryOrder === id ? null : id)}
          getStatusBadge={getStatusBadge}
          getStatusLabel={getStatusLabel}
          getOrderDisplayInfo={getOrderDisplayInfo}
          getCountryLabel={getCountryLabel}
          onClose={() => {
            setShowUserHistoryModal(false);
            setUserHistoryOrders([]);
            setExpandedHistoryOrder(null);
          }}
        />
      )}
    </div>
  );
}

function UserOrderHistoryModal({
  userName,
  orders,
  loading,
  expandedOrder,
  onToggleExpand,
  getStatusBadge,
  getStatusLabel,
  getOrderDisplayInfo,
  getCountryLabel,
  onClose,
}: {
  userName: string;
  orders: Order[];
  loading: boolean;
  expandedOrder: string | null;
  onToggleExpand: (id: string) => void;
  getStatusBadge: (status: string) => string;
  getStatusLabel: (status: string) => string;
  getOrderDisplayInfo: (order: Order) => { displayName: string; totalPV: number; image: string | null | undefined; itemCount: number };
  getCountryLabel: (code: string) => string;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSpent = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const currency = orders[0]?.currency_code || 'USD';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-brand-600" />
                Order History - {userName}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {orders.length} total order{orders.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {!loading && orders.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${getStatusBadge(status)}`}
                >
                  {getStatusLabel(status)}: {count}
                </span>
              ))}
              {totalSpent > 0 && (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-800">
                  Total Spent: {currency} {totalSpent.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No orders found for this user</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const { displayName, totalPV, image, itemCount } = getOrderDisplayInfo(order);
                const isExpanded = expandedOrder === order.id;

                return (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition"
                  >
                    <button
                      onClick={() => onToggleExpand(order.id)}
                      className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50 transition"
                    >
                      {image && (
                        <img src={image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm truncate">{order.order_number}</span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusBadge(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                          {order.payment_screenshot_url && order.status === 'awaiting_payment' && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700 flex items-center gap-1">
                              <ImageIcon size={10} /> Proof
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="truncate max-w-[200px]">{displayName}</span>
                          {itemCount > 1 && (
                            <span className="flex items-center gap-0.5 text-brand-600 font-medium">
                              <Package size={10} /> {itemCount} items
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-900 text-sm">
                          {order.currency_code} {order.total_amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-orange-600 font-medium">{totalPV} PV</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-gray-100 bg-gray-50">
                        <div className="pt-4 space-y-3">
                          {order.order_items && order.order_items.length > 0 ? (
                            order.order_items.map((item) => (
                              <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-100">
                                {item.product.image_url && (
                                  <img src={item.product.image_url} alt={getLocalizedProductName(item.product, language)} className="w-10 h-10 rounded object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{getLocalizedProductName(item.product, language)}</p>
                                  <p className="text-xs text-gray-500">
                                    Qty: {item.quantity}{item.free_quantity > 0 && ` (+${item.free_quantity} free)`}
                                    {' '} @ {order.currency_code} {item.unit_price.toFixed(2)}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-semibold">{order.currency_code} {item.subtotal.toFixed(2)}</p>
                                  <p className="text-xs text-orange-600">{item.pv_value * (item.quantity + item.free_quantity)} PV</p>
                                </div>
                              </div>
                            ))
                          ) : order.product ? (
                            <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-100">
                              {order.product.image_url && (
                                <img src={order.product.image_url} alt={getLocalizedProductName(order.product, language)} className="w-10 h-10 rounded object-cover" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{getLocalizedProductName(order.product, language)}</p>
                                <p className="text-xs text-gray-500">Qty: {order.quantity}</p>
                              </div>
                              <p className="text-sm font-semibold">{order.currency_code} {order.total_amount.toFixed(2)}</p>
                            </div>
                          ) : null}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                            <div>
                              <p className="text-xs text-gray-500">Country</p>
                              <p className="text-sm font-medium">{getCountryLabel(order.region)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Date</p>
                              <p className="text-sm font-medium">{new Date(order.created_at).toLocaleString()}</p>
                            </div>
                            {order.payment_verified_at && (
                              <div>
                                <p className="text-xs text-gray-500">Paid</p>
                                <p className="text-sm font-medium">{new Date(order.payment_verified_at).toLocaleDateString()}</p>
                              </div>
                            )}
                          </div>

                          {order.rejection_reason && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-red-700">Rejection Reason</p>
                              <p className="text-sm text-red-600 mt-0.5">{order.rejection_reason}</p>
                            </div>
                          )}
                          {order.admin_notes && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-blue-700">Admin Notes</p>
                              <p className="text-sm text-blue-600 mt-0.5">{order.admin_notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2.5 rounded-lg hover:bg-gray-300 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
