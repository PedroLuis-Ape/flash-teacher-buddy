-- 1. Add account_id and user_tag to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_id UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS user_tag TEXT UNIQUE;

-- 2. Create function to generate user_tag
CREATE OR REPLACE FUNCTION public.generate_user_tag()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tag TEXT;
  tag_exists BOOLEAN;
  random_suffix TEXT;
BEGIN
  LOOP
    -- Generate 4-character alphanumeric suffix from UUID
    random_suffix := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 4));
    new_tag := 'PTC-' || random_suffix;
    
    -- Check if tag exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_tag = new_tag) INTO tag_exists;
    
    EXIT WHEN NOT tag_exists;
  END LOOP;
  
  RETURN new_tag;
END;
$$;

-- 3. Create trigger to auto-generate user_tag on profile creation
CREATE OR REPLACE FUNCTION public.set_user_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_tag IS NULL THEN
    NEW.user_tag := public.generate_user_tag();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_tag_trigger ON public.profiles;
CREATE TRIGGER set_user_tag_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_user_tag();

-- 4. Backfill user_tag for existing profiles
UPDATE public.profiles
SET user_tag = public.generate_user_tag()
WHERE user_tag IS NULL;

-- 5. Create gift_offers table
CREATE TABLE IF NOT EXISTS public.gift_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skin_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'canceled')),
  sent_by TEXT NOT NULL DEFAULT 'developer_admin',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '30 days'),
  claimed_at TIMESTAMP WITH TIME ZONE,
  request_id TEXT UNIQUE
);

-- Enable RLS on gift_offers
ALTER TABLE public.gift_offers ENABLE ROW LEVEL SECURITY;

-- 6. Create security definer function to check developer_admin role (using string comparison for now)
CREATE OR REPLACE FUNCTION public.is_developer_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'developer_admin'
  )
$$;

-- 7. RLS Policies for gift_offers
CREATE POLICY "Developer admins can view all gifts"
ON public.gift_offers
FOR SELECT
USING (public.is_developer_admin(auth.uid()));

CREATE POLICY "Users can view their own gifts"
ON public.gift_offers
FOR SELECT
USING (auth.uid() = recipient_user_id);

CREATE POLICY "Developer admins can create gifts"
ON public.gift_offers
FOR INSERT
WITH CHECK (public.is_developer_admin(auth.uid()));

CREATE POLICY "Users can update their own gifts (claim/cancel)"
ON public.gift_offers
FOR UPDATE
USING (auth.uid() = recipient_user_id)
WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY "Developer admins can update all gifts"
ON public.gift_offers
FOR UPDATE
USING (public.is_developer_admin(auth.uid()));

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gift_offers_recipient ON public.gift_offers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_gift_offers_status ON public.gift_offers(status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_tag ON public.profiles(user_tag);
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON public.profiles(account_id);

-- 9. Update skins_catalog to support admin features
ALTER TABLE public.skins_catalog
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'preview', 'published', 'archived')),
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS max_supply INTEGER,
ADD COLUMN IF NOT EXISTS current_supply INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avatar_src TEXT,
ADD COLUMN IF NOT EXISTS card_src TEXT;

-- Update existing skins to published status
UPDATE public.skins_catalog SET status = 'published' WHERE status IS NULL;