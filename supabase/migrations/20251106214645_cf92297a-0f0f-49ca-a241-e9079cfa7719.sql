-- Fix 1: Make developer_admin role immutable
DROP POLICY IF EXISTS "Users can update to owner role via function" ON user_roles;

CREATE POLICY "Users can update to owner role via function"
ON user_roles
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND role != 'developer_admin'::app_role
)
WITH CHECK (
  auth.uid() = user_id 
  AND role != 'developer_admin'::app_role
);

-- Fix 2: Create atomic gift claim function
CREATE OR REPLACE FUNCTION claim_gift_atomic(p_gift_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift gift_offers%ROWTYPE;
  v_existing_item user_inventory%ROWTYPE;
  v_skin_price integer;
  v_current_balance integer;
  v_new_balance integer;
  v_result jsonb;
BEGIN
  -- Lock and get gift details
  SELECT * INTO v_gift
  FROM gift_offers
  WHERE id = p_gift_id
    AND recipient_user_id = p_user_id
  FOR UPDATE;

  -- Validate gift exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift not found');
  END IF;

  -- Check status
  IF v_gift.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift already processed');
  END IF;

  -- Check expiration
  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift expired');
  END IF;

  -- Check if user already owns this skin
  SELECT * INTO v_existing_item
  FROM user_inventory
  WHERE user_id = p_user_id
    AND skin_id = v_gift.skin_id;

  -- Get skin price
  SELECT price_pitecoin INTO v_skin_price
  FROM skins_catalog
  WHERE id = v_gift.skin_id;

  IF v_skin_price IS NULL THEN
    v_skin_price := 0;
  END IF;

  -- Get current balance with lock
  SELECT balance_pitecoin INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_existing_item.id IS NOT NULL THEN
    -- User already owns it - convert to PITECOIN
    v_new_balance := v_current_balance + v_skin_price;

    -- Update balance
    UPDATE profiles
    SET balance_pitecoin = v_new_balance
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO pitecoin_transactions (user_id, amount, balance_after, type, source)
    VALUES (p_user_id, v_skin_price, v_new_balance, 'bonus', 'gift_conversion');

    -- Mark gift as claimed
    UPDATE gift_offers
    SET status = 'claimed', claimed_at = NOW()
    WHERE id = p_gift_id;

    RETURN jsonb_build_object(
      'success', true,
      'alreadyOwned', true,
      'pitecoinBonus', v_skin_price
    );
  ELSE
    -- Add skin to inventory
    INSERT INTO user_inventory (user_id, skin_id)
    VALUES (p_user_id, v_gift.skin_id);

    -- Mark gift as claimed
    UPDATE gift_offers
    SET status = 'claimed', claimed_at = NOW()
    WHERE id = p_gift_id;

    RETURN jsonb_build_object(
      'success', true,
      'alreadyOwned', false
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION claim_gift_atomic(uuid, uuid) TO authenticated;