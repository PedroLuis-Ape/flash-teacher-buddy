import { supabase } from "@/integrations/supabase/client";

export interface GiftOffer {
  id: string;
  recipient_user_id: string;
  skin_id: string;
  status: 'pending' | 'claimed' | 'expired' | 'canceled';
  sent_by: string;
  message?: string;
  created_at: string;
  expires_at?: string;
  claimed_at?: string;
  request_id?: string;
}

/**
 * Send a gift to a user
 */
export async function sendGift(
  recipientUserId: string,
  skinId: string,
  message?: string
): Promise<{ success: boolean; error?: string; gift?: GiftOffer }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Generate idempotency key
    const requestId = crypto.randomUUID();

    const { data, error } = await supabase
      .from('gift_offers')
      .insert({
        recipient_user_id: recipientUserId,
        skin_id: skinId,
        message: message || null,
        request_id: requestId,
        sent_by: 'developer_admin',
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending gift:', error);
      return { success: false, error: error.message };
    }

    return { success: true, gift: data as GiftOffer };
  } catch (err) {
    console.error('Exception sending gift:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get all gifts for the current user
 */
export async function getUserGifts(): Promise<GiftOffer[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from('gift_offers')
      .select('*')
      .eq('recipient_user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching gifts:', error);
      return [];
    }

    return (data as GiftOffer[]) || [];
  } catch (err) {
    console.error('Exception fetching gifts:', err);
    return [];
  }
}

/**
 * Claim a gift (atomic operation via database function)
 */
export async function claimGift(
  giftId: string
): Promise<{ success: boolean; error?: string; alreadyOwned?: boolean; pitecoinBonus?: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Call atomic database function
    const { data, error } = await supabase.rpc('claim_gift_atomic', {
      p_gift_id: giftId,
      p_user_id: session.user.id
    });

    if (error) {
      console.error('Error claiming gift:', error);
      return { success: false, error: error.message };
    }

    // Parse result from database function
    const result = data as { 
      success: boolean; 
      error?: string; 
      alreadyOwned?: boolean; 
      pitecoinBonus?: number 
    };

    return result;
  } catch (err) {
    console.error('Exception claiming gift:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Cancel/dismiss a gift
 */
export async function dismissGift(giftId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from('gift_offers')
      .update({ status: 'canceled' })
      .eq('id', giftId)
      .eq('recipient_user_id', session.user.id);

    if (error) {
      console.error('Error dismissing gift:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Exception dismissing gift:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get pending gift count for badge
 */
export async function getPendingGiftCount(): Promise<number> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;

    const { count, error } = await supabase
      .from('gift_offers')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', session.user.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error counting gifts:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Exception counting gifts:', err);
    return 0;
  }
}

/**
 * Search users by tag or account ID (admin only)
 */
export async function searchUsers(query: string): Promise<any[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    // Check if user is developer_admin
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!role || (role.role as string) !== 'developer_admin') {
      return [];
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, email, user_tag, account_id')
      .or(`user_tag.ilike.%${query}%,account_id::text.ilike.%${query}%,first_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception searching users:', err);
    return [];
  }
}