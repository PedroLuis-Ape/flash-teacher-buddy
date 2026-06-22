/**
 * Store Engine - purchases, inventory and equipment for PITECOIN bundles.
 */

import { supabase } from '@/integrations/supabase/client';
import { FEATURE_FLAGS } from './featureFlags';

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
  status?: 'draft' | 'preview' | 'published' | 'archived';
  type?: 'avatar' | 'card' | 'bundle';
  created_at?: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  skin_id: string;
  acquired_at: string;
  skin?: SkinItem;
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
    case 'epic':
      return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
    case 'rare':
      return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
    case 'normal':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function getRarityLabel(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return 'Lendário';
    case 'epic':
      return 'Épico';
    case 'rare':
      return 'Raro';
    case 'normal':
      return 'Normal';
    default:
      return rarity;
  }
}

/**
 * The database catalog is the only source of store availability.
 * Adding or archiving a package never requires a frontend whitelist change.
 */
export async function getSkinsCaltalog(): Promise<SkinItem[]> {
  try {
    const { data, error } = await supabase
      .from('public_catalog')
      .select('*')
      .eq('is_active', true)
      .eq('approved', true)
      .eq('status', 'published')
      .eq('type', 'bundle')
      .not('avatar_final', 'is', null)
      .neq('avatar_final', '')
      .not('card_final', 'is', null)
      .neq('card_final', '')
      .order('price_pitecoin', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).filter(
      (item: any) =>
        typeof item.avatar_final === 'string' &&
        item.avatar_final.trim().length > 0 &&
        typeof item.card_final === 'string' &&
        item.card_final.trim().length > 0,
    ) as SkinItem[];
  } catch (error) {
    console.error('[StoreEngine] Error fetching catalog:', error);
    return [];
  }
}

/**
 * Inventory keeps archived packages available to their owners.
 */
export async function getUserInventory(userId: string): Promise<InventoryItem[]> {
  try {
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', userId)
      .order('acquired_at', { ascending: false });

    if (inventoryError) throw inventoryError;
    if (!inventoryData || inventoryData.length === 0) return [];

    const skinIds = inventoryData.map((item) => item.skin_id);
    const { data: publicSkins, error: publicError } = await supabase
      .from('public_catalog')
      .select('*')
      .in('id', skinIds);

    if (publicError) throw publicError;

    const skinsMap = new Map<string, SkinItem>(
      (publicSkins || []).map((skin: any) => [skin.id, skin as SkinItem]),
    );

    const missingIds = skinIds.filter((id) => !skinsMap.has(id));
    if (missingIds.length > 0) {
      const { data: sourceSkins, error: sourceError } = await supabase
        .from('skins_catalog')
        .select(
          'id, name, rarity, price_pitecoin, avatar_final, card_final, avatar_src, card_src, avatar_img, card_img, is_active, approved, status, type, description',
        )
        .in('id', missingIds);

      if (sourceError) {
        console.warn('[StoreEngine] skins_catalog fallback error:', sourceError);
      } else {
        (sourceSkins || []).forEach((skin: any) => {
          const mapped: SkinItem = {
            id: skin.id,
            name: skin.name,
            rarity: skin.rarity,
            price_pitecoin: skin.price_pitecoin,
            avatar_final:
              skin.avatar_final || skin.avatar_src || skin.avatar_img || '',
            card_final: skin.card_final || skin.card_src || skin.card_img || '',
            description: skin.description || null,
            is_active: skin.is_active ?? false,
            approved: skin.approved ?? false,
            status: skin.status,
            type: skin.type,
          };

          if (mapped.avatar_final || mapped.card_final) {
            skinsMap.set(mapped.id, mapped);
          }
        });
      }
    }

    return inventoryData.map((item) => ({
      ...item,
      skin: skinsMap.get(item.skin_id),
    })) as InventoryItem[];
  } catch (error) {
    console.error('[StoreEngine] Error fetching inventory:', error);
    return [];
  }
}

export async function userOwnsSkin(userId: string, skinId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('id')
      .eq('user_id', userId)
      .eq('skin_id', skinId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    console.error('[StoreEngine] Error checking ownership:', error);
    return false;
  }
}

/**
 * The RPC reads the authoritative price from skins_catalog. The client price is
 * retained only for backward compatibility and audit metadata.
 */
export async function purchaseSkin(
  userId: string,
  skinId: string,
  price: number,
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  if (!FEATURE_FLAGS.economy_enabled) {
    return { success: false, message: 'Sistema de economia desabilitado' };
  }

  try {
    const operationId = crypto.randomUUID();
    const { data, error } = await supabase.rpc('process_skin_purchase', {
      p_operation_id: operationId,
      p_buyer_id: userId,
      p_skin_id: skinId,
      p_price: price,
    });

    if (error) throw error;
    if (!data) {
      return {
        success: false,
        message: 'Erro ao processar compra. Tente novamente.',
      };
    }

    const result = data as {
      success: boolean;
      message: string;
      new_balance?: number;
    };

    return {
      success: result.success,
      message: result.message,
      newBalance: result.new_balance,
    };
  } catch (error) {
    console.error('[StoreEngine] Error purchasing skin:', error);
    return {
      success: false,
      message: 'Erro ao processar compra. Tente novamente.',
    };
  }
}

/**
 * Use the catalog URL tied to a purchased package. Never trust an arbitrary URL
 * supplied by the UI when setting the profile photo.
 */
export async function equipAvatarAsPhoto(
  userId: string,
  skinId: string,
  _avatarUrl?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const ownsSkin = await userOwnsSkin(userId, skinId);
    if (!ownsSkin) {
      return { success: false, message: 'Você não possui este pacote.' };
    }

    const { data: catalogItem, error: catalogError } = await supabase
      .from('public_catalog')
      .select('avatar_final')
      .eq('id', skinId)
      .maybeSingle();

    if (catalogError) throw catalogError;
    if (!catalogItem?.avatar_final) {
      return { success: false, message: 'Avatar sem imagem válida.' };
    }

    const separator = catalogItem.avatar_final.includes('?') ? '&' : '?';
    const avatarUrl = `${catalogItem.avatar_final}${separator}profile=${Date.now()}`;
    const { data, error } = await supabase.rpc('update_own_profile', {
      p_user_id: userId,
      p_avatar_url: avatarUrl,
      p_avatar_skin_id: skinId,
    });

    if (error) throw error;
    if (data && (data as any).success === false) {
      return { success: false, message: 'Erro ao atualizar foto de perfil.' };
    }

    return { success: true, message: 'Foto de perfil atualizada!' };
  } catch (error) {
    console.error('[StoreEngine] Error updating profile photo:', error);
    return { success: false, message: 'Erro ao atualizar foto de perfil.' };
  }
}

export async function equipSkin(
  userId: string,
  skinId: string,
  type: 'avatar' | 'mascot',
  operationId?: string,
): Promise<{
  success: boolean;
  message: string;
  error?: string;
  alreadyProcessed?: boolean;
}> {
  try {
    const opId = operationId || crypto.randomUUID();
    const { data, error } = await supabase.rpc('equip_skin_atomic', {
      p_operation_id: opId,
      p_user_id: userId,
      p_kind: type,
      p_skin_id: skinId,
    });

    if (error) {
      console.error('[StoreEngine] RPC error:', error);
    }

    if (data && (data as any).success) {
      const result = data as {
        message: string;
        error?: string;
        already_processed?: boolean;
      };
      return {
        success: true,
        message: result.message,
        error: result.error,
        alreadyProcessed: result.already_processed,
      };
    }

    const { data: ownedItem, error: ownershipError } = await supabase
      .from('user_inventory')
      .select('id')
      .eq('user_id', userId)
      .eq('skin_id', skinId)
      .maybeSingle();

    if (ownershipError) {
      console.error('[StoreEngine] Ownership check error:', ownershipError);
      return {
        success: false,
        message: 'Não foi possível ativar. Tente novamente.',
        error: 'INTERNAL_ERROR',
      };
    }
    if (!ownedItem) {
      return {
        success: false,
        message: 'Você não possui este item.',
        error: 'NOT_OWNER',
      };
    }

    const { data: catalogItem, error: catalogError } = await supabase
      .from('public_catalog')
      .select('id, avatar_final, card_final')
      .eq('id', skinId)
      .maybeSingle();

    if (catalogError || !catalogItem) {
      console.error('[StoreEngine] Catalog fetch error:', catalogError);
      return {
        success: false,
        message: 'Item não encontrado.',
        error: 'NOT_FOUND',
      };
    }

    if (type === 'avatar' && !catalogItem.avatar_final) {
      return {
        success: false,
        message: 'Este item não tem a imagem de avatar necessária.',
        error: 'MISSING_ASSET',
      };
    }
    if (type === 'mascot' && !catalogItem.card_final) {
      return {
        success: false,
        message: 'Este item não tem a imagem de card necessária.',
        error: 'MISSING_ASSET',
      };
    }

    const rpcParams =
      type === 'avatar'
        ? { p_user_id: userId, p_avatar_skin_id: skinId }
        : { p_user_id: userId, p_mascot_skin_id: skinId };
    const { data: updateData, error: updateError } = await supabase.rpc(
      'update_own_profile',
      rpcParams,
    );

    if (updateError || (updateData && (updateData as any).success === false)) {
      console.error('[StoreEngine] Profile update error:', updateError);
      return {
        success: false,
        message: 'Não foi possível ativar. Tente novamente.',
        error: 'INTERNAL_ERROR',
      };
    }

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
        skin_id: skinId,
      });
    }

    return {
      success: true,
      message:
        type === 'avatar'
          ? 'Avatar ativado com sucesso.'
          : 'Mascote ativado com sucesso.',
    };
  } catch (error) {
    console.error('[StoreEngine] Error equipping skin:', error);
    return {
      success: false,
      message: 'Não foi possível ativar. Tente novamente.',
      error: 'INTERNAL_ERROR',
    };
  }
}

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
