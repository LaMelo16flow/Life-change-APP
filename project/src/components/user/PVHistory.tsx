import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, PVTransaction } from '../../lib/supabase';
import { TrendingUp, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export function PVHistory() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<PVTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!profile) return;

      const { data } = await supabase
        .from('pv_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setTransactions(data);
      setLoading(false);
    };

    fetchTransactions();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const totalEarned = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalSpent = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">PV History</h2>
        <p className="text-slate-600 mt-1">Track all your point value transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            <p className="text-sm text-slate-600">Current Balance</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{profile?.total_pv || 0} PV</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <ArrowUpCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm text-slate-600">Total Earned</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{totalEarned} PV</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <ArrowDownCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-slate-600">Total Spent</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{totalSpent} PV</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Transaction History</h3>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No transactions yet</h3>
            <p className="text-slate-600">
              Your PV transaction history will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          transaction.transaction_type === 'purchase'
                            ? 'bg-brand-100 text-brand-700'
                            : transaction.transaction_type === 'meeting'
                            ? 'bg-green-100 text-green-700'
                            : transaction.transaction_type === 'reward'
                            ? 'bg-purple-100 text-purple-700'
                            : transaction.transaction_type === 'bonus'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {transaction.description || 'No description'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span
                        className={`font-semibold ${
                          Number(transaction.amount) > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {Number(transaction.amount) > 0 ? '+' : ''}
                        {transaction.amount} PV
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
