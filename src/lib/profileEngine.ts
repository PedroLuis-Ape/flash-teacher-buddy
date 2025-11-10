import { supabase } from "@/integrations/supabase/client";

export interface PublicProfile {
  public_id: string;
  user_type: 'professor' | 'aluno';
  name: string;
  level: number;
  stats: {
    ptc: number;
    points: number;
    xp_total: number;
    lists_created: number;
    cards_studied: number;
  };
  avatar?: {
    url: string;
    name: string;
    rarity: string;
  } | null;
  mascot?: {
    url: string;
    name: string;
    rarity: string;
  } | null;
}

export interface UserSearchResult {
  public_id: string;
  user_type: 'professor' | 'aluno';
  name: string;
  avatar_url?: string | null;
}

/**
 * Initialize public ID for current user
 */
export async function initPublicId(userId: string): Promise<{
  success: boolean;
  publicId?: string;
  error?: string;
  message?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('init_public_id', {
      p_user_id: userId
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      public_id?: string;
      error?: string;
      message: string;
    };

    return {
      success: result.success,
      publicId: result.public_id,
      error: result.error,
      message: result.message
    };
  } catch (error) {
    console.error('[ProfileEngine] Error initializing public ID:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao inicializar ID público.'
    };
  }
}

/**
 * Get public profile by ID
 */
export async function getPublicProfile(publicId: string): Promise<{
  success: boolean;
  profile?: PublicProfile;
  error?: string;
  message?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_public_profile', {
      p_public_id: publicId
    });

    if (error) throw error;

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Resposta inválida do servidor.'
      };
    }

    const result = data as unknown as {
      success: boolean;
      profile?: PublicProfile;
      error?: string;
      message?: string;
    };

    return result;
  } catch (error) {
    console.error('[ProfileEngine] Error fetching public profile:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao carregar perfil.'
    };
  }
}

/**
 * Search users by name or ID
 */
export async function searchUsers(
  query: string,
  userType: 'professor' | 'aluno' | 'todos' = 'todos',
  limit: number = 20,
  offset: number = 0
): Promise<{
  success: boolean;
  users?: UserSearchResult[];
  total?: number;
  hasMore?: boolean;
  error?: string;
  message?: string;
}> {
  try {
    if (query.trim().length < 2) {
      return {
        success: false,
        error: 'INVALID_INPUT',
        message: 'Digite pelo menos 2 caracteres para buscar.'
      };
    }

    const { data, error } = await supabase.rpc('search_users', {
      p_query: query.trim(),
      p_user_type: userType,
      p_limit: limit,
      p_offset: offset
    });

    if (error) throw error;

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Resposta inválida do servidor.'
      };
    }

    const result = data as unknown as {
      success: boolean;
      users?: UserSearchResult[];
      total?: number;
      has_more?: boolean;
      error?: string;
      message?: string;
    };

    return {
      success: result.success,
      users: result.users,
      total: result.total,
      hasMore: result.has_more,
      error: result.error,
      message: result.message
    };
  } catch (error) {
    console.error('[ProfileEngine] Error searching users:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao buscar usuários.'
    };
  }
}
