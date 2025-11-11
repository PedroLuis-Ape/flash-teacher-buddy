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
  slug?: string;
  approved?: boolean;
  approved_by?: string;
  created_at?: string;
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

// Allowed slugs for store (whitelist)
const ALLOWED_SLUGS = [
  'piteco_vampiro',
  'piteco_prime',
  'piteco_zombie'
];

/**
 * Fetch all available skins from catalog (approved and whitelisted only)
 */
export async function getSkinsCaltalog(): Promise<SkinItem[]> {
  try {
    const { data, error } = await supabase
      .from('public_catalog')
      .select('*')
      .eq('is_active', true)
      .eq('approved', true)
      .in('slug', ALLOWED_SLUGS)
      .order('price_pitecoin', { ascending: true });

    if (error) throw error;
    
    // Deduplicate by slug (keep only the most recent per slug)
    const deduped = new Map<string, SkinItem>();
    (data || []).forEach((item: any) => {
      const existing = deduped.get(item.slug);
      if (!existing || new Date(item.created_at) > new Date(existing.created_at)) {
        deduped.set(item.slug, item as SkinItem);
      }
    });
    
    return Array.from(deduped.values());
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
    const skinIds = inventoryData.map(i => i.skin_id);
    const { data: pubSkins, error: pubErr } = await supabase
      .from('public_catalog')
      .select('*')
      .in('id', skinIds);

    if (pubErr) throw pubErr;

    // Start with public_catalog results
    const skinsMap = new Map<string, SkinItem>((pubSkins || []).map((s: any) => [s.id, s as SkinItem]));

    // Fallback: fetch any missing items from skins_catalog and map fields
    const missingIds = skinIds.filter(id => !skinsMap.has(id));
    if (missingIds.length) {
      const { data: skuSkins, error: skuErr } = await supabase
        .from('skins_catalog')
        .select('id, name, rarity, price_pitecoin, avatar_src, card_src, avatar_img, card_img, is_active, description')
        .in('id', missingIds);

      if (skuErr) {
        console.warn('[StoreEngine] skins_catalog fallback error:', skuErr);
      } else {
        (skuSkins || []).forEach((s: any) => {
          const mapped: SkinItem = {
            id: s.id,
            name: s.name,
            rarity: s.rarity,
            price_pitecoin: s.price_pitecoin,
            avatar_final: s.avatar_src || s.avatar_img || '',
            card_final: s.card_src || s.card_img || '',
            description: s.description || null,
            is_active: s.is_active ?? true,
          } as SkinItem;

          // Only add if there is at least one media to display
          if (mapped.avatar_final || mapped.card_final) {
            skinsMap.set(mapped.id, mapped);
          }
        });
      }
    }
    
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
 * Purchase a skin with PITECOIN - ATOMIC & IDEMPOTENT
 */
export async function purchaseSkin(
  userId: string,
  skinId: string,
  price: number
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  if (!FEATURE_FLAGS.economy_enabled) {
    return { success: false, message: 'Sistema de economia desabilitado' };
  }

  try {
    // Generate unique operation ID for idempotency
    const operationId = crypto.randomUUID();

    // Call atomic purchase function in database
    const { data, error } = await supabase.rpc('process_skin_purchase', {
      p_operation_id: operationId,
      p_buyer_id: userId,
      p_skin_id: skinId,
      p_price: price
    });

    if (error) {
      throw error;
    }

    if (!data) {
      return {
        success: false,
        message: 'Erro ao processar compra. Tente novamente.'
      };
    }

    const result = data as {
      success: boolean;
      error?: string;
      message: string;
      new_balance?: number;
      purchase_id?: string;
      inventory_id?: string;
    };

    return {
      success: result.success,
      message: result.message,
      newBalance: result.new_balance
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
 * Equip a skin (avatar or mascot) - ATOMIC & IDEMPOTENT
 */
export async function equipSkin(
  userId: string,
  skinId: string,
  type: 'avatar' | 'mascot',
  operationId?: string
): Promise<{ 
  success: boolean; 
  message: string;
  error?: string;
  alreadyProcessed?: boolean;
}> {
  try {
    // Generate operation ID for idempotency if not provided
    const opId = operationId || crypto.randomUUID();

    // Call atomic equip function in database (preferred path)
    const { data, error } = await supabase.rpc('equip_skin_atomic', {
      p_operation_id: opId,
      p_user_id: userId,
      p_kind: type,
      p_skin_id: skinId
    });

    if (error) {
      console.error('[StoreEngine] RPC error:', error);
    }

    // If RPC returned a valid success response, honor it
    if (data && (data as any).success) {
      const result = data as {
        success: boolean;
        error?: string;
        message: string;
        already_processed?: boolean;
        avatar_skin_id?: string;
        mascot_skin_id?: string;
      };

      return {
        success: true,
        message: result.message,
        error: result.error,
        alreadyProcessed: result.already_processed
      };
    }

    // Fallback path: perform validated client-side equip to avoid user being blocked
    console.warn('[StoreEngine] Falling back to client-side equip flow');

    // 1) Ownership check (RLS ensures we only see own rows)
    const { data: ownInv, error: ownErr } = await supabase
      .from('user_inventory')
      .select('id')
      .eq('user_id', userId)
      .eq('skin_id', skinId)
      .maybeSingle();

    if (ownErr) {
      console.error('[StoreEngine] Ownership check error:', ownErr);
      return { success: false, message: 'Não foi possível ativar. Tente novamente.', error: 'INTERNAL_ERROR' };
    }
    if (!ownInv) {
      return { success: false, message: 'Você não possui este item.', error: 'NOT_OWNER' };
    }

    // 2) Load catalog media and validate required asset
    const { data: cat, error: catErr } = await supabase
      .from('public_catalog')
      .select('id, avatar_final, card_final')
      .eq('id', skinId)
      .maybeSingle();

    if (catErr || !cat) {
      console.error('[StoreEngine] Catalog fetch error:', catErr);
      return { success: false, message: 'Item não encontrado.', error: 'NOT_FOUND' };
    }

    if (type === 'avatar' && (!cat.avatar_final || cat.avatar_final === '')) {
      return { success: false, message: 'Este item não tem a imagem de avatar necessária.', error: 'MISSING_ASSET' };
    }
    if (type === 'mascot' && (!cat.card_final || cat.card_final === '')) {
      return { success: false, message: 'Este item não tem a imagem de card necessária.', error: 'MISSING_ASSET' };
    }

    // 3) Update profile (RLS allows user to update own profile)
    const updates = type === 'avatar' 
      ? { avatar_skin_id: skinId }
      : { mascot_skin_id: skinId };

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (upErr) {
      console.error('[StoreEngine] Profile update error:', upErr);
      return { success: false, message: 'Não foi possível ativar. Tente novamente.', error: 'INTERNAL_ERROR' };
    }

    // 4) Idempotent log (best-effort)
    const { data: existingLog } = await supabase
      .from('equip_logs')
      .select('id')
      .eq('operation_id', opId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingLog) {
      await supabase.from('equip_logs').insert({
        operation_id: opId,
        user_id: userId,
        kind: type,
        skin_id: skinId
      });
    }

    return {
      success: true,
      message: type === 'avatar' ? 'Avatar ativado com sucesso.' : 'Mascote ativado com sucesso.'
    };
  } catch (error) {
    console.error('[StoreEngine] Error equipping skin:', error);
    return {
      success: false,
      message: 'Não foi possível ativar. Tente novamente.',
      error: 'INTERNAL_ERROR'
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
