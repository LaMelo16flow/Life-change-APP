import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Rank, PromotionRequest } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Award, CheckCircle, Clock, XCircle, ArrowUp, Ban, AlertTriangle } from 'lucide-react';
import {
  sendRankPromotionRequestNotification,
  sendAutoRankPromotionNotification,
} from '../../utils/notifications';

export function RankProgress() {
  const { profile } = useAuth();
  const toast = useToast();
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [currentRank, setCurrentRank] = useState<Rank | null>(null);
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const [ranksRes, requestsRes] = await Promise.all([
      supabase.from('ranks').select('*').order('display_order', { ascending: true }),
      supabase
        .from('promotion_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('requested_at', { ascending: false }),
    ]);

    const allRanks = ranksRes.data || [];
    let requests = requestsRes.data || [];

    setRanks(allRanks);

    const current = allRanks.find((r) => r.id === profile.current_rank_id);
    setCurrentRank(current || null);

    requests = await autoCancelIneligibleRequests(requests, allRanks, profile.total_pv);
    setPromotionRequests(requests);

    await autoRequestEligiblePromotion(allRanks, current || null, requests, profile.total_pv);

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const autoCancelIneligibleRequests = async (
    requests: PromotionRequest[],
    allRanks: Rank[],
    totalPV: number
  ): Promise<PromotionRequest[]> => {
    const updated = [...requests];
    const pendingRequests = updated.filter((r) => r.status === 'pending');

    for (const req of pendingRequests) {
      const targetRank = allRanks.find((r) => r.id === req.to_rank_id);
      if (!targetRank) continue;

      if (totalPV < targetRank.required_pv) {
        const { error } = await supabase
          .from('promotion_requests')
          .update({ status: 'cancelled' })
          .eq('id', req.id);

        if (!error) {
          const idx = updated.findIndex((p) => p.id === req.id);
          if (idx !== -1) updated[idx] = { ...updated[idx], status: 'cancelled' };
        }
      }
    }

    return updated;
  };

  const autoRequestEligiblePromotion = async (
    allRanks: Rank[],
    current: Rank | null,
    requests: PromotionRequest[],
    totalPV: number
  ) => {
    if (!profile || !current) return;

    const nextRank = allRanks.find(
      (r) => r.display_order === current.display_order + 1 && r.is_active
    );
    if (!nextRank) return;

    if (totalPV < nextRank.required_pv) return;

    const hasExistingRequest = requests.some(
      (r) => r.to_rank_id === nextRank.id && (r.status === 'pending' || r.status === 'approved')
    );
    if (hasExistingRequest) return;

    if (nextRank.requires_approval) {
      const { error } = await supabase.from('promotion_requests').insert({
        user_id: profile.id,
        from_rank_id: profile.current_rank_id,
        to_rank_id: nextRank.id,
        status: 'pending',
      });

      if (!error) {
        const { data } = await supabase
          .from('promotion_requests')
          .select('*')
          .eq('user_id', profile.id)
          .order('requested_at', { ascending: false });
        if (data) setPromotionRequests(data);

        await sendRankPromotionRequestNotification({
          userId: profile.id,
          userName: profile.full_name,
          fromRank: current?.name || 'N/A',
          toRank: nextRank.name,
        });

        toast.success(`You qualify for ${nextRank.name}! A promotion request has been submitted.`);
      }
    } else {
      const { error } = await supabase.from('promotion_requests').insert({
        user_id: profile.id,
        from_rank_id: profile.current_rank_id,
        to_rank_id: nextRank.id,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      });

      if (!error) {
        await supabase
          .from('profiles')
          .update({ current_rank_id: nextRank.id })
          .eq('id', profile.id);

        await sendAutoRankPromotionNotification({
          userId: profile.id,
          userName: profile.full_name,
          newRank: nextRank.name,
        });

        toast.success(`You have been promoted to ${nextRank.name}!`);
        window.location.reload();
      }
    }
  };

  const handleRequestPromotion = async (rankId: string) => {
    if (!profile || processing) return;
    setProcessing(true);

    try {
      const { error } = await supabase.from('promotion_requests').insert({
        user_id: profile.id,
        from_rank_id: profile.current_rank_id,
        to_rank_id: rankId,
        status: 'pending',
      });

      if (error) throw error;

      const targetRank = ranks.find((r) => r.id === rankId);
      await sendRankPromotionRequestNotification({
        userId: profile.id,
        userName: profile.full_name,
        fromRank: currentRank?.name || 'N/A',
        toRank: targetRank?.name || 'Unknown',
      });

      toast.success('Promotion request submitted!');
      const { data } = await supabase
        .from('promotion_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('requested_at', { ascending: false });
      if (data) setPromotionRequests(data);
    } catch {
      toast.error('Failed to submit promotion request');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('promotion_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Promotion request cancelled.');
      setPromotionRequests((prev) =>
        prev.map((p) => (p.id === requestId ? { ...p, status: 'cancelled' } : p))
      );
    } catch {
      toast.error('Failed to cancel request');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const nextRank = currentRank
    ? ranks.find((r) => r.display_order === currentRank.display_order + 1)
    : null;
  const pvProgress = nextRank && nextRank.required_pv > 0
    ? Math.min(100, ((profile?.total_pv || 0) / nextRank.required_pv) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rank Progression</h2>
        <p className="text-slate-600 mt-1">Track your journey through the ranks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-5 h-5" style={{ color: currentRank?.color || '#6B7280' }} />
            <p className="text-sm text-slate-600">Current Rank</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{currentRank?.name || 'N/A'}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <ArrowUp className="w-5 h-5 text-green-600" />
            <p className="text-sm text-slate-600">Total PV</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{profile?.total_pv || 0}</p>
        </div>
      </div>

      {nextRank && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900">Progress to {nextRank.name}</h3>
            <span className="text-sm font-medium text-slate-500">{Math.round(pvProgress)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 mb-3">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{ width: `${pvProgress}%`, backgroundColor: nextRank.color }}
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>{profile?.total_pv || 0} / {nextRank.required_pv} PV</span>
          </div>
        </div>
      )}

      {promotionRequests.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Promotion Requests</h3>
          <div className="space-y-3">
            {promotionRequests.slice(0, 5).map((request) => {
              const toRank = ranks.find((r) => r.id === request.to_rank_id);
              const fromRank = ranks.find((r) => r.id === request.from_rank_id);
              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5" style={{ color: toRank?.color || '#6B7280' }} />
                    <div>
                      <p className="font-semibold text-slate-900">
                        {fromRank?.name || 'N/A'} &rarr; {toRank?.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {new Date(request.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status === 'pending' && (
                      <>
                        <span className="flex items-center gap-1 text-sm font-semibold text-yellow-600">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                        <button
                          onClick={() => handleCancelRequest(request.id)}
                          disabled={processing}
                          className="ml-2 px-3 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Approved
                      </span>
                    )}
                    {request.status === 'rejected' && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                        <XCircle className="w-4 h-4" />
                        Rejected
                      </span>
                    )}
                    {request.status === 'cancelled' && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-gray-500">
                        <Ban className="w-4 h-4" />
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">All Ranks</h3>
        <div className="space-y-4">
          {ranks.map((rank) => {
            const isCurrentRank = rank.id === profile?.current_rank_id;
            const isPastRank = currentRank
              ? rank.display_order < currentRank.display_order
              : false;
            const meetsPV = (profile?.total_pv || 0) >= rank.required_pv;
            const hasPendingRequest = promotionRequests.some(
              (r) => r.to_rank_id === rank.id && r.status === 'pending'
            );
            const isNextRank = rank.display_order === (currentRank?.display_order || 0) + 1;
            const pvShort = Math.max(0, rank.required_pv - (profile?.total_pv || 0));
            const canRequest = meetsPV && isNextRank;

            return (
              <div
                key={rank.id}
                className={`p-6 rounded-xl border-2 transition ${
                  isCurrentRank
                    ? 'border-brand-500 bg-brand-50'
                    : isPastRank
                    ? 'border-green-500 bg-green-50'
                    : meetsPV && isNextRank
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${rank.color}20` }}
                    >
                      <Award className="w-6 h-6" style={{ color: rank.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-slate-900">{rank.name}</h4>
                        {isCurrentRank && (
                          <span className="px-2 py-1 bg-brand-700 text-white text-xs font-semibold rounded-full">
                            Current
                          </span>
                        )}
                        {isPastRank && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-slate-600">
                        <span className={meetsPV && !isCurrentRank && !isPastRank ? 'text-green-600 font-medium' : ''}>
                          PV: {rank.required_pv}
                        </span>
                        {rank.requires_approval && (
                          <span className="text-orange-600">Requires Approval</span>
                        )}
                      </div>
                      {!isCurrentRank && !isPastRank && isNextRank && pvShort > 0 && (
                        <div className="flex gap-3 mt-1.5 text-xs">
                          <span className="flex items-center gap-1 text-orange-600">
                            <AlertTriangle className="w-3 h-3" />
                            {pvShort} PV needed
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isCurrentRank && !isPastRank && (
                    <div>
                      {hasPendingRequest ? (
                        <span className="px-4 py-2 bg-yellow-100 text-yellow-700 text-sm font-semibold rounded-lg">
                          Request Pending
                        </span>
                      ) : canRequest ? (
                        <button
                          onClick={() => handleRequestPromotion(rank.id)}
                          disabled={processing}
                          className="px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium disabled:bg-gray-400"
                        >
                          Request Promotion
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg">
                          Locked
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
