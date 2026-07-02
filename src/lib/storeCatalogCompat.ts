import { supabase } from '@/integrations/supabase/client';
import type { SkinItem } from './storeEngine';

export const LEGACY_PRODUCTION_SLUGS = [
  'piteco_vampiro',
  'piteco_prime',
  'piteco-zombie',
  'piteco_zombie',
] as const;

function hasCompleteAssets(item: any): item is SkinItem {
  return (
    typeof item?.avatar_final === 'string' &&
    item.avatar_final.trim().length > 0 &&
    typeof item?.card_final === 'string' &&
    item.card_final.trim().length > 0
  );
}

/**
 * Transitional reader for the current Lovable production backend.
 *
 * The migrated catalog uses status/type. The still-active legacy production
 * database has the original three packages without those fields populated.
 * We first read the new contract and only fall back to the known legacy slugs
 * when the strict catalog is empty or unavailable. This keeps the store online
 * during the full database migration without mixing data from two backends.
 */
export async function getProductionStoreCatalog(): Promise<SkinItem[]> {
  const strictResult = await supabase
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

  const strictItems = ((strictResult.data || []).filter(hasCompleteAssets) as unknown) as SkinItem[];
  if (!strictResult.error && strictItems.length > 0) {
    return strictItems;
  }

  if (strictResult.error) {
    console.warn(
      '[StoreCatalog] Strict catalog unavailable; using legacy production compatibility.',
      strictResult.error,
    );
  } else {
    console.info('[StoreCatalog] Strict catalog is empty; using legacy production compatibility.');
  }

  const legacyResult = await supabase
    .from('public_catalog')
    .select('*')
    .eq('is_active', true)
    .eq('approved', true)
    .in('slug', [...LEGACY_PRODUCTION_SLUGS])
    .order('price_pitecoin', { ascending: true });

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return ((legacyResult.data || []).filter(hasCompleteAssets) as unknown) as SkinItem[];
}
