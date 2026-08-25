import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedProductName } from '../../utils/productLocale';
import { TrendingUp, Package, Users, Lightbulb, Lock, ShoppingBag } from 'lucide-react';

const BRAND_GREEN = '#16a34a';
const ACCENT_ORANGE = '#eb6834';
const ADVICE_ELIGIBILITY_DAYS = 90;
const VELOCITY_WINDOW_DAYS = 30;
const REORDER_LOOKAHEAD_DAYS = 30;

interface RawOrderItemRow {
  product_id: string;
  quantity: number;
  free_quantity: number;
  product: { name: string; name_en: string | null } | { name: string; name_en: string | null }[] | null;
  orders: {
    status: string;
    created_at: string;
    user_id: string;
    user: { full_name: string } | { full_name: string }[] | null;
  } | {
    status: string;
    created_at: string;
    user_id: string;
    user: { full_name: string } | { full_name: string }[] | null;
  }[];
}

interface ProductStat {
  productId: string;
  name: string;
  totalUnits: number;
  orderCount: number;
  unitsRecent: number;
}

interface BuyerStat {
  userId: string;
  userName: string;
  productId: string;
  productName: string;
  totalUnits: number;
}

interface AdviceRow {
  productId: string;
  name: string;
  available: number;
  velocityPerWeek: number;
  suggestedReorder: number;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function BarRow({ label, value, maxValue, color, formatValue }: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  formatValue: (n: number) => string;
}) {
  const widthPct = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 sm:w-40 flex-shrink-0 text-sm text-gray-700 truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 min-w-0">
        <svg viewBox="0 0 100 20" className="w-full h-5" preserveAspectRatio="none">
          <title>{`${label}: ${formatValue(value)}`}</title>
          <rect x="0" y="0" width="100" height="20" fill="transparent" />
          <rect
            x="0"
            y="3"
            width={widthPct}
            height="14"
            rx="4"
            fill={color}
          />
        </svg>
      </div>
      <div className="w-16 flex-shrink-0 text-sm font-semibold text-gray-900 text-right tabular-nums">
        {formatValue(value)}
      </div>
    </div>
  );
}

export default function ProductAnalytics() {
  const { profile, isMaster } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [topBuyers, setTopBuyers] = useState<BuyerStat[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});
  const [thresholdMap, setThresholdMap] = useState<Record<string, number>>({});
  const [earliestOrderAt, setEarliestOrderAt] = useState<string | null>(null);
  const [adviceEnabled, setAdviceEnabled] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [itemsRes, inventoryRes, earliestRes, settingRes] = await Promise.all([
        supabase
          .from('order_items')
          .select(`
            product_id,
            quantity,
            free_quantity,
            product:products(name, name_en),
            orders!inner(status, created_at, user_id, user:profiles(full_name))
          `)
          .in('orders.status', ['pending', 'awaiting_payment', 'completed']),
        supabase.from('product_inventory').select('product_id, quantity, reserved_quantity, low_stock_threshold').eq('region', 'CA'),
        supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('admin_settings').select('value').eq('key', 'purchase_advice_enabled').maybeSingle(),
      ]);

      const rows = (itemsRes.data || []) as unknown as RawOrderItemRow[];
      const recentCutoff = Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

      const productMap = new Map<string, ProductStat>();
      const buyerMap = new Map<string, BuyerStat>();

      for (const row of rows) {
        const order = firstOf(row.orders);
        const product = firstOf(row.product);
        if (!order || !product) continue;

        const units = row.quantity + row.free_quantity;
        const name = getLocalizedProductName(product, language);

        const existing = productMap.get(row.product_id);
        const isRecent = new Date(order.created_at).getTime() >= recentCutoff;
        if (existing) {
          existing.totalUnits += units;
          existing.orderCount += 1;
          if (isRecent) existing.unitsRecent += units;
        } else {
          productMap.set(row.product_id, {
            productId: row.product_id,
            name,
            totalUnits: units,
            orderCount: 1,
            unitsRecent: isRecent ? units : 0,
          });
        }

        const buyerName = firstOf(order.user)?.full_name || 'Unknown';
        const buyerKey = `${order.user_id}::${row.product_id}`;
        const existingBuyer = buyerMap.get(buyerKey);
        if (existingBuyer) {
          existingBuyer.totalUnits += units;
        } else {
          buyerMap.set(buyerKey, {
            userId: order.user_id,
            userName: buyerName,
            productId: row.product_id,
            productName: name,
            totalUnits: units,
          });
        }
      }

      setProductStats(Array.from(productMap.values()));
      setTopBuyers(Array.from(buyerMap.values()).sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 15));

      const invMap: Record<string, number> = {};
      const threshMap: Record<string, number> = {};
      (inventoryRes.data || []).forEach((inv) => {
        invMap[inv.product_id] = inv.quantity - inv.reserved_quantity;
        threshMap[inv.product_id] = inv.low_stock_threshold;
      });
      setInventoryMap(invMap);
      setThresholdMap(threshMap);

      setEarliestOrderAt(earliestRes.data?.created_at || null);
      setAdviceEnabled(settingRes.data?.value?.enabled === true);
    } catch (error) {
      console.error('Error loading product analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  const daysOfHistory = earliestOrderAt
    ? Math.floor((Date.now() - new Date(earliestOrderAt).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const hasEnoughHistory = daysOfHistory >= ADVICE_ELIGIBILITY_DAYS;
  const adviceVisible = hasEnoughHistory && adviceEnabled;

  const topByTotalUnits = useMemo(
    () => [...productStats].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 8),
    [productStats]
  );
  const topByVelocity = useMemo(
    () => [...productStats].sort((a, b) => b.unitsRecent - a.unitsRecent).slice(0, 8),
    [productStats]
  );

  const adviceRows: AdviceRow[] = useMemo(() => {
    if (!adviceVisible) return [];
    return productStats
      .map((p) => {
        const velocityPerDay = p.unitsRecent / VELOCITY_WINDOW_DAYS;
        const available = inventoryMap[p.productId] ?? 0;
        const projectedDemand = Math.ceil(velocityPerDay * REORDER_LOOKAHEAD_DAYS);
        const suggestedReorder = Math.max(0, projectedDemand - available);
        return {
          productId: p.productId,
          name: p.name,
          available,
          velocityPerWeek: Math.round(velocityPerDay * 7 * 10) / 10,
          suggestedReorder,
        };
      })
      .filter((r) => r.suggestedReorder > 0)
      .sort((a, b) => b.suggestedReorder - a.suggestedReorder);
  }, [adviceVisible, productStats, inventoryMap]);

  const handleToggleAdvice = async () => {
    if (!isMaster) return;
    setSavingToggle(true);
    try {
      const nextValue = !adviceEnabled;
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { key: 'purchase_advice_enabled', value: { enabled: nextValue }, updated_by: profile?.id },
          { onConflict: 'key' }
        );
      if (error) throw error;
      setAdviceEnabled(nextValue);
    } catch (error) {
      console.error('Error updating purchase advice setting:', error);
    } finally {
      setSavingToggle(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading analytics...</div>;
  }

  const maxTotalUnits = topByTotalUnits[0]?.totalUnits || 0;
  const maxVelocity = topByVelocity[0]?.unitsRecent || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-brand-600" />
          Product Analytics
        </h2>
        <p className="text-gray-600">See what's moving, who's buying, and what to restock</p>
      </div>

      {productStats.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No order data yet - analytics will appear once orders come in.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Package size={18} className="text-brand-600" />
                Top Products by Total Units Sold
              </h3>
              <p className="text-xs text-gray-500 mb-4">All-time, across pending/awaiting-payment/completed orders</p>
              <div className="space-y-2">
                {topByTotalUnits.map((p) => (
                  <BarRow
                    key={p.productId}
                    label={p.name}
                    value={p.totalUnits}
                    maxValue={maxTotalUnits}
                    color={BRAND_GREEN}
                    formatValue={(n) => `${n}`}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <TrendingUp size={18} style={{ color: ACCENT_ORANGE }} />
                Fastest-Moving Products
              </h3>
              <p className="text-xs text-gray-500 mb-4">Units sold in the last {VELOCITY_WINDOW_DAYS} days</p>
              <div className="space-y-2">
                {topByVelocity.map((p) => (
                  <BarRow
                    key={p.productId}
                    label={p.name}
                    value={p.unitsRecent}
                    maxValue={maxVelocity}
                    color={ACCENT_ORANGE}
                    formatValue={(n) => `${n}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Users size={18} className="text-brand-600" />
              Top Buyers by Product
            </h3>
            <p className="text-xs text-gray-500 mb-4">Which customers buy the most of each product</p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Customer</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Product</th>
                    <th className="text-right py-2 font-medium text-gray-500">Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topBuyers.map((b) => (
                    <tr key={`${b.userId}::${b.productId}`}>
                      <td className="py-2 pr-4 text-gray-900">{b.userName}</td>
                      <td className="py-2 pr-4 text-gray-700">{b.productName}</td>
                      <td className="py-2 text-right font-medium text-gray-900 tabular-nums">{b.totalUnits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Lightbulb size={18} className="text-amber-500" />
                Purchase Advice
              </h3>
              {isMaster && (
                <button
                  onClick={handleToggleAdvice}
                  disabled={savingToggle || !hasEnoughHistory}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    adviceEnabled
                      ? 'bg-brand-50 border-brand-300 text-brand-700 hover:bg-brand-100'
                      : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {adviceEnabled ? 'Advice enabled - click to disable' : 'Enable purchase advice'}
                </button>
              )}
            </div>

            {!hasEnoughHistory ? (
              <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                <Lock size={16} className="flex-shrink-0 mt-0.5" />
                <span>
                  Purchase advice unlocks once {ADVICE_ELIGIBILITY_DAYS} days of order history exist
                  ({daysOfHistory} of {ADVICE_ELIGIBILITY_DAYS} days so far) - there isn't enough history yet to
                  produce a reliable recommendation.
                </span>
              </div>
            ) : !adviceEnabled ? (
              <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                <Lock size={16} className="flex-shrink-0 mt-0.5" />
                <span>
                  {ADVICE_ELIGIBILITY_DAYS} days of history are in - purchase advice is ready, but only the master
                  admin can turn it on.
                </span>
              </div>
            ) : adviceRows.length === 0 ? (
              <p className="text-sm text-gray-500">No restocking needed right now based on recent sales velocity.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-4 font-medium text-gray-500">Product</th>
                      <th className="text-right py-2 pr-4 font-medium text-gray-500">Available</th>
                      <th className="text-right py-2 pr-4 font-medium text-gray-500">Selling / week</th>
                      <th className="text-right py-2 font-medium text-gray-500">Suggested reorder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adviceRows.map((r) => (
                      <tr key={r.productId}>
                        <td className="py-2 pr-4 text-gray-900">{r.name}</td>
                        <td className="py-2 pr-4 text-right text-gray-700 tabular-nums">{r.available}</td>
                        <td className="py-2 pr-4 text-right text-gray-700 tabular-nums">{r.velocityPerWeek}</td>
                        <td className="py-2 text-right font-semibold text-brand-700 tabular-nums flex items-center justify-end gap-1">
                          <ShoppingBag size={14} />
                          {r.suggestedReorder}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-3">
                  Estimate only: based on units sold in the last {VELOCITY_WINDOW_DAYS} days, projected {REORDER_LOOKAHEAD_DAYS} days forward, minus current available stock.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
