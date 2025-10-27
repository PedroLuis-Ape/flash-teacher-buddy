/**
 * Economy and inventory types (read-only phase)
 * No mutations, no real transactions yet
 */

export type SkinRarity = 'normal' | 'rare' | 'epic' | 'legendary';

export interface SkinCatalogItem {
  id: string;
  name: string;
  rarity: SkinRarity;
  price_pitecoin: number;
  avatar_badge_url: string;
  card_url: string;
  is_active: boolean;
}

export interface UserEconomy {
  balance_pitecoin: number;
  xp_total: number;
  pts_weekly: number;
  level: number; // derived from xp: Math.floor(Math.sqrt(xp_total / 100))
}

export interface UserInventoryItem {
  id: string;
  user_id: string;
  skin_id: string;
  acquired_at: Date;
}

export interface UserAppearance {
  avatar_skin_id: string | null;
  mascot_skin_id: string | null;
}

/**
 * Mock catalog data
 * In production, this would come from database
 */
export const MOCK_SKINS_CATALOG: SkinCatalogItem[] = [
  {
    id: 'piteco-prime',
    name: 'Piteco Prime',
    rarity: 'normal',
    price_pitecoin: 0,
    avatar_badge_url: '/placeholder.svg',
    card_url: '/placeholder.svg',
    is_active: true,
  },
];

/**
 * Calculate user level from XP
 */
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

/**
 * Get mock user economy data
 */
export function getMockEconomy(): UserEconomy {
  return {
    balance_pitecoin: 0,
    xp_total: 0,
    pts_weekly: 0,
    level: 0,
  };
}

/**
 * Get mock user inventory (always includes Piteco Prime)
 */
export function getMockInventory(): UserInventoryItem[] {
  return [
    {
      id: 'inv-1',
      user_id: 'mock',
      skin_id: 'piteco-prime',
      acquired_at: new Date(),
    },
  ];
}

/**
 * Get mock appearance (defaults to Piteco Prime)
 */
export function getMockAppearance(): UserAppearance {
  return {
    avatar_skin_id: 'piteco-prime',
    mascot_skin_id: 'piteco-prime',
  };
}
