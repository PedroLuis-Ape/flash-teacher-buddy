/**
 * Store Engine - Handle PITECOIN purchases and inventory
 */

import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "./featureFlags";

export interface SkinItem {
  id: string;
  name: string;
  rarity: 'normal' | 'rare' | 'epic' | 'legendary';
  price_pitecoin: number;
  avatar_final: string;
  card_final: string;
  description: string | null;
  is_active: boolean;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  skin_id: string;
  acquired_at: string;
  skin?: SkinItem;
}

/**
 * Get rarity color for badges
 */
export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
    case 'epic': return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
    case 'rare': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
    case 'normal': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

/**
 * Get rarity label
 */
export function getRarityLabel(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'Lendário';
    case 'epic': return 'Épico';
    case 'rare': return 'Raro';
    case 'normal': return 'Normal';
    default: return rarity;
  }
}

/**
 * Fetch all available skins from catalog
 */
export async function getSkinsCaltalog(): Promise<SkinItem[]> {
  try {
    const { data, error } = await supabase
      .from('public_catalog')
      .select('*')
      .eq('is_active', true)
      .order('price_pitecoin', { ascending: true });

    if (error) throw error;
    return (data || []) as SkinItem[];
  } catch (error) {
    console.error('[StoreEngine] Error fetching catalog:', error);
    return [];
  }
}

/**
 * Fetch user's inventory with skin details
 */
export async function getUserInventory(userId: string): Promise<InventoryItem[]> {
  try {
    // Fetch inventory
    const { data: inventoryData, error: invError } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', userId)
      .order('acquired_at', { ascending: false });

    if (invError) throw invError;
    if (!inventoryData || inventoryData.length === 0) return [];

    // Fetch all skins from catalog
    const skinIds = inventoryData.map(item => item.skin_id);
    const { data: skinsData, error: skinsError } = await supabase
      .from('public_catalog')
      .select('*')
      .in('id', skinIds);

    if (skinsError) throw skinsError;

    // Map skins to inventory items
    const skinsMap = new Map(skinsData?.map(skin => [skin.id, skin as SkinItem]) || []);
    
    return inventoryData.map(item => ({
      ...item,
      skin: skinsMap.get(item.skin_id)
    })) as InventoryItem[];
  } catch (error) {
    console.error('[StoreEngine] Error fetching inventory:', error);
    return [];
  }
}

/**
 * Check if user owns a skin
 */
export async function userOwnsSkin(userId: string, skinId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('id')
      .eq('user_id', userId)
      .eq('skin_id', skinId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('[StoreEngine] Error checking ownership:', error);
    return false;
  }
}

/**
 * Purchase a skin with PITECOIN
 */
export async function purchaseSkin(
  userId: string,
  skinId: string,
  price: number
): Promise<{ success: boolean; message: string }> {
  if (!FEATURE_FLAGS.economy_enabled) {
    return { success: false, message: 'Sistema de economia desabilitado' };
  }

  try {
    // Check if already owned
    const alreadyOwned = await userOwnsSkin(userId, skinId);
    if (alreadyOwned) {
      return { success: false, message: 'Você já possui este pacote!' };
    }

    // Get current balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance_pitecoin')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[StoreEngine] Profile error:', profileError);
      throw profileError;
    }
    
    if (!profile) {
      return { success: false, message: 'Perfil não encontrado' };
    }

    // Check if user has enough balance (free items don't need balance)
    if (price > 0 && profile.balance_pitecoin < price) {
      return {
        success: false,
        message: `Saldo insuficiente! Você tem ₱${profile.balance_pitecoin}, mas precisa de ₱${price}.`
      };
    }

    const newBalance = profile.balance_pitecoin - price;

    // Deduct balance (only if price > 0)
    if (price > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance_pitecoin: newBalance })
        .eq('id', userId);

      if (updateError) {
        console.error('[StoreEngine] Balance update error:', updateError);
        throw updateError;
      }
    }

    // Add to inventory
    const { error: inventoryError } = await supabase
      .from('user_inventory')
      .insert({
        user_id: userId,
        skin_id: skinId,
      });

    if (inventoryError) {
      console.error('[StoreEngine] Inventory error:', inventoryError);
      // Rollback balance if inventory insert fails
      if (price > 0) {
        await supabase
          .from('profiles')
          .update({ balance_pitecoin: profile.balance_pitecoin })
          .eq('id', userId);
      }
      throw inventoryError;
    }

    // Log transaction (only if price > 0)
    if (price > 0) {
      const { error: txError } = await supabase
        .from('pitecoin_transactions')
        .insert({
          user_id: userId,
          amount: -price,
          balance_after: newBalance,
          type: 'spend',
          source: `Compra: ${skinId}`,
        });

      if (txError) {
        console.error('[StoreEngine] Transaction log error:', txError);
        // Don't rollback - the purchase succeeded, just log failed
      }
    }

    return {
      success: true,
      message: price === 0 
        ? '✅ Pacote gratuito adicionado ao seu inventário!' 
        : '✅ Compra realizada! Pacote adicionado ao seu inventário!'
    };
  } catch (error) {
    console.error('[StoreEngine] Error purchasing skin:', error);
    return {
      success: false,
      message: 'Erro ao processar compra. Tente novamente.'
    };
  }
}

/**
 * Equip a skin (avatar or mascot)
 */
export async function equipSkin(
  userId: string,
  skinId: string,
  type: 'avatar' | 'mascot'
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if user owns the skin
    const owns = await userOwnsSkin(userId, skinId);
    if (!owns) {
      return { success: false, message: 'Você não possui este item!' };
    }

    // Update profile
    const field = type === 'avatar' ? 'avatar_skin_id' : 'mascot_skin_id';
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: skinId })
      .eq('id', userId);

    if (error) throw error;

    return {
      success: true,
      message: `${type === 'avatar' ? 'Avatar' : 'Mascote'} equipado com sucesso!`
    };
  } catch (error) {
    console.error('[StoreEngine] Error equipping skin:', error);
    return {
      success: false,
      message: 'Erro ao equipar item. Tente novamente.'
    };
  }
}

/**
 * Get user's equipped skins
 */
export async function getEquippedSkins(userId: string): Promise<{
  avatar_skin_id: string | null;
  mascot_skin_id: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_skin_id, mascot_skin_id')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return {
      avatar_skin_id: data?.avatar_skin_id || null,
      mascot_skin_id: data?.mascot_skin_id || null,
    };
  } catch (error) {
    console.error('[StoreEngine] Error fetching equipped skins:', error);
    return {
      avatar_skin_id: null,
      mascot_skin_id: null,
    };
  }
}
