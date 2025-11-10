import { supabase } from "@/integrations/supabase/client";

export interface ExchangeConfig {
  rate_ppc_per_pt: number;
  min_pts_per_tx: number;
  daily_pts_cap: number;
}

export interface ExchangeQuote {
  pts_in: number;
  ppc_out: number;
  rate: number;
  daily_used_pts: number;
  daily_remaining_pts: number;
}

/**
 * Get exchange configuration
 */
export async function getExchangeConfig(): Promise<{
  success: boolean;
  config?: ExchangeConfig;
  error?: string;
  message?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_exchange_config');

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
      config?: ExchangeConfig;
      error?: string;
      message?: string;
    };

    return result;
  } catch (error) {
    console.error('[ExchangeEngine] Error fetching config:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao carregar configuração.'
    };
  }
}

/**
 * Get exchange quote
 */
export async function getExchangeQuote(
  userId: string,
  pts: number
): Promise<{
  success: boolean;
  quote?: ExchangeQuote;
  error?: string;
  message?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_exchange_quote', {
      p_user_id: userId,
      p_pts: pts
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
      pts_in?: number;
      ppc_out?: number;
      rate?: number;
      daily_used_pts?: number;
      daily_remaining_pts?: number;
      error?: string;
      message?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.message
      };
    }

    return {
      success: true,
      quote: {
        pts_in: result.pts_in!,
        ppc_out: result.ppc_out!,
        rate: result.rate!,
        daily_used_pts: result.daily_used_pts!,
        daily_remaining_pts: result.daily_remaining_pts!
      }
    };
  } catch (error) {
    console.error('[ExchangeEngine] Error getting quote:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Erro ao calcular cotação.'
    };
  }
}

/**
 * Process exchange conversion (atomic and idempotent)
 */
export async function processExchange(
  userId: string,
  pts: number,
  operationId?: string
): Promise<{
  success: boolean;
  newPoints?: number;
  newPtc?: number;
  ppcReceived?: number;
  alreadyProcessed?: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Generate operation ID for idempotency if not provided
    const opId = operationId || crypto.randomUUID();

    const { data, error } = await supabase.rpc('process_exchange', {
      p_operation_id: opId,
      p_user_id: userId,
      p_pts: pts
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
      new_points?: number;
      new_ptc?: number;
      ppc_received?: number;
      already_processed?: boolean;
      error?: string;
      message?: string;
    };

    return {
      success: result.success,
      newPoints: result.new_points,
      newPtc: result.new_ptc,
      ppcReceived: result.ppc_received,
      alreadyProcessed: result.already_processed,
      error: result.error,
      message: result.message
    };
  } catch (error) {
    console.error('[ExchangeEngine] Error processing exchange:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Não foi possível converter agora. Tente novamente.'
    };
  }
}
