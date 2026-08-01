import { useState, useEffect } from 'react';
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownRight, CreditCard, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/currency';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  status: string;
  created_at: string;
}

export function Wallet() {
  const { user } = useAuth();
  const toast = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadWalletData();
    loadTransactions();
  }, []);

  const loadWalletData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance, currency')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setBalance(data.balance || 0);
        setCurrency(data.currency || 'USD');
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.warning('Please enter a valid amount');
      return;
    }

    setProcessing(true);

    try {
      const { error } = await supabase.rpc('process_transaction', {
        p_user_id: user?.id,
        p_type: 'deposit',
        p_amount: amountValue,
        p_description: 'Deposit via card',
        p_metadata: { method: 'card' }
      });

      if (error) throw error;

      await loadWalletData();
      await loadTransactions();
      setAmount('');
      setShowAddMoney(false);
      toast.success('Money added successfully!');
    } catch (error: any) {
      console.error('Error adding money:', error);
      toast.error(error.message || 'Failed to add money. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'refund':
      case 'commission':
      case 'bonus':
        return <ArrowDownRight className="w-5 h-5 text-green-600" />;
      case 'withdrawal':
      case 'purchase':
        return <ArrowUpRight className="w-5 h-5 text-red-600" />;
      default:
        return <History className="w-5 h-5 text-slate-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'refund':
      case 'commission':
      case 'bonus':
        return 'text-green-600';
      case 'withdrawal':
      case 'purchase':
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Loading wallet...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 rounded-xl shadow-lg p-4 sm:p-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-xs sm:text-sm text-brand-100">Available Balance</div>
              <div className="text-2xl sm:text-3xl font-bold">{formatCurrency(balance, currency)}</div>
            </div>
          </div>
          <button
            onClick={() => setShowAddMoney(!showAddMoney)}
            className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-white text-brand-600 rounded-lg hover:bg-brand-50 transition font-semibold flex items-center justify-center gap-2 shadow-md"
          >
            <Plus className="w-5 h-5" />
            Add Money
          </button>
        </div>

        {showAddMoney && (
          <form onSubmit={handleAddMoney} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 mt-4">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-brand-100" />
              <h3 className="text-base sm:text-lg font-semibold">Add Money via Card</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-100 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-medium text-sm sm:text-base">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-16 sm:pl-20 pr-4 py-3 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 text-sm sm:text-base"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 px-4 sm:px-6 py-3 bg-white text-brand-600 rounded-lg hover:bg-brand-50 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {processing ? 'Processing...' : 'Add Money'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMoney(false);
                    setAmount('');
                  }}
                  className="px-4 sm:px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition font-semibold text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="mt-4 text-xs text-brand-100 bg-white/10 rounded-lg p-3">
              <p className="font-semibold mb-1">Note:</p>
              <p>
                This is a demo implementation. For production use, integrate with a payment provider like Stripe
                to securely process card payments.
              </p>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5" />
            Transaction History
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <History className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-sm sm:text-base">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-4 sm:p-6 hover:bg-slate-50 transition">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm sm:text-base truncate">{transaction.description}</div>
                      <div className="text-xs sm:text-sm text-slate-500">
                        {new Date(transaction.created_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 hidden sm:block">
                        Balance after: {formatCurrency(transaction.balance_after, currency)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm sm:text-lg font-bold ${getTransactionColor(transaction.type)}`}>
                      {transaction.amount > 0 ? '+' : ''}
                      {formatCurrency(Math.abs(transaction.amount), currency)}
                    </div>
                    <div className="text-xs mt-1">
                      <span
                        className={`px-2 py-0.5 sm:py-1 rounded-full ${
                          transaction.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : transaction.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
