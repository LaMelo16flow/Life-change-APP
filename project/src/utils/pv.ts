import { supabase } from '../lib/supabase';

export function roundPVToMultiple(pv: number): number {
  return Math.floor(pv / 30) * 30;
}

export async function autoCreatePromotionRequest(userId: string, newTotalPV: number) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('current_rank_id')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile?.current_rank_id) return;

    const { data: allRanks } = await supabase
      .from('ranks')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (!allRanks) return;

    const currentRank = allRanks.find(r => r.id === userProfile.current_rank_id);
    if (!currentRank) return;

    const nextRank = allRanks.find(r => r.display_order === currentRank.display_order + 1);
    if (!nextRank || newTotalPV < nextRank.required_pv) return;

    const { data: existingRequests } = await supabase
      .from('promotion_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('to_rank_id', nextRank.id)
      .in('status', ['pending', 'approved']);

    if (existingRequests && existingRequests.length > 0) return;

    if (nextRank.requires_approval) {
      await supabase.from('promotion_requests').insert({
        user_id: userId,
        from_rank_id: userProfile.current_rank_id,
        to_rank_id: nextRank.id,
        status: 'pending',
      });

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'promotion',
        title: 'Rank Promotion Eligible!',
        message: `You now qualify for ${nextRank.name}! Your promotion request has been submitted for review.`,
        action_url: '/rank',
      });
    } else {
      await supabase.from('promotion_requests').insert({
        user_id: userId,
        from_rank_id: userProfile.current_rank_id,
        to_rank_id: nextRank.id,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      });

      await supabase
        .from('profiles')
        .update({ current_rank_id: nextRank.id })
        .eq('id', userId);
    }
  } catch (err) {
    console.error('Auto promotion request error:', err);
  }
}
