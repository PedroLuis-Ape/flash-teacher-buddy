-- Criar tabela de logs de compras com idempotência
CREATE TABLE IF NOT EXISTS public.purchase_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE, -- para idempotência
  buyer_id UUID NOT NULL,
  skin_id TEXT NOT NULL,
  price_pitecoin INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed', -- completed, failed, refunded
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_purchase_logs_buyer ON public.purchase_logs(buyer_id);
CREATE INDEX idx_purchase_logs_operation ON public.purchase_logs(operation_id);
CREATE INDEX idx_purchase_logs_created ON public.purchase_logs(created_at DESC);

-- RLS policies
ALTER TABLE public.purchase_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchase logs"
  ON public.purchase_logs FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Developer admins can view all purchase logs"
  ON public.purchase_logs FOR SELECT
  USING (is_developer_admin(auth.uid()));

-- Função atômica para processar compra
CREATE OR REPLACE FUNCTION public.process_skin_purchase(
  p_operation_id UUID,
  p_buyer_id UUID,
  p_skin_id TEXT,
  p_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_already_owned BOOLEAN;
  v_skin_exists BOOLEAN;
  v_purchase_id UUID;
  v_inventory_id UUID;
BEGIN
  -- Verificar idempotência - se já processamos esta operação
  IF EXISTS (SELECT 1 FROM public.purchase_logs WHERE operation_id = p_operation_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'duplicate_operation',
      'message', 'Esta compra já foi processada anteriormente'
    );
  END IF;

  -- Verificar se o skin existe no catálogo
  SELECT EXISTS(
    SELECT 1 FROM public.public_catalog 
    WHERE id = p_skin_id AND is_active = true
  ) INTO v_skin_exists;

  IF NOT v_skin_exists THEN
    -- Log falha
    INSERT INTO public.purchase_logs (
      operation_id, buyer_id, skin_id, price_pitecoin,
      balance_before, balance_after, status, error_message
    ) VALUES (
      p_operation_id, p_buyer_id, p_skin_id, p_price,
      0, 0, 'failed', 'Skin não encontrado no catálogo'
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'skin_not_found',
      'message', 'Este item não está disponível'
    );
  END IF;

  -- Verificar se já possui o item
  SELECT EXISTS(
    SELECT 1 FROM public.user_inventory 
    WHERE user_id = p_buyer_id AND skin_id = p_skin_id
  ) INTO v_already_owned;

  IF v_already_owned THEN
    -- Log falha
    INSERT INTO public.purchase_logs (
      operation_id, buyer_id, skin_id, price_pitecoin,
      balance_before, balance_after, status, error_message
    ) VALUES (
      p_operation_id, p_buyer_id, p_skin_id, p_price,
      0, 0, 'failed', 'Usuário já possui este item'
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_owned',
      'message', 'Você já possui este pacote!'
    );
  END IF;

  -- Pegar saldo atual com lock
  SELECT balance_pitecoin INTO v_current_balance
  FROM public.profiles
  WHERE id = p_buyer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'Usuário não encontrado'
    );
  END IF;

  -- Verificar saldo suficiente (apenas se preço > 0)
  IF p_price > 0 AND v_current_balance < p_price THEN
    -- Log falha
    INSERT INTO public.purchase_logs (
      operation_id, buyer_id, skin_id, price_pitecoin,
      balance_before, balance_after, status, error_message
    ) VALUES (
      p_operation_id, p_buyer_id, p_skin_id, p_price,
      v_current_balance, v_current_balance, 'failed', 'Saldo insuficiente'
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_funds',
      'message', format('Saldo insuficiente! Você tem ₱%s, mas precisa de ₱%s', v_current_balance, p_price)
    );
  END IF;

  -- Calcular novo saldo
  v_new_balance := v_current_balance - p_price;

  -- Debitar saldo (apenas se preço > 0)
  IF p_price > 0 THEN
    UPDATE public.profiles
    SET balance_pitecoin = v_new_balance
    WHERE id = p_buyer_id;
  ELSE
    v_new_balance := v_current_balance; -- mantém o mesmo saldo para itens gratuitos
  END IF;

  -- Adicionar ao inventário
  INSERT INTO public.user_inventory (user_id, skin_id)
  VALUES (p_buyer_id, p_skin_id)
  RETURNING id INTO v_inventory_id;

  -- Registrar transação (apenas se preço > 0)
  IF p_price > 0 THEN
    INSERT INTO public.pitecoin_transactions (
      user_id, amount, balance_after, type, source
    ) VALUES (
      p_buyer_id, -p_price, v_new_balance, 'spend', 'Compra: ' || p_skin_id
    );
  END IF;

  -- Log sucesso
  INSERT INTO public.purchase_logs (
    operation_id, buyer_id, skin_id, price_pitecoin,
    balance_before, balance_after, status
  ) VALUES (
    p_operation_id, p_buyer_id, p_skin_id, p_price,
    v_current_balance, v_new_balance, 'completed'
  ) RETURNING id INTO v_purchase_id;

  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'inventory_id', v_inventory_id,
    'new_balance', v_new_balance,
    'message', CASE 
      WHEN p_price = 0 THEN '✅ Pacote gratuito adicionado ao seu inventário!'
      ELSE '✅ Compra realizada! Pacote adicionado ao seu inventário!'
    END
  );

EXCEPTION WHEN OTHERS THEN
  -- Log erro inesperado
  INSERT INTO public.purchase_logs (
    operation_id, buyer_id, skin_id, price_pitecoin,
    balance_before, balance_after, status, error_message
  ) VALUES (
    p_operation_id, p_buyer_id, p_skin_id, p_price,
    COALESCE(v_current_balance, 0), COALESCE(v_current_balance, 0), 
    'failed', SQLERRM
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'unexpected_error',
    'message', 'Erro ao processar compra. Tente novamente.'
  );
END;
$$;