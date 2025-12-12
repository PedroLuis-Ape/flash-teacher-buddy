-- user_list_activity: tracks when user last opened/studied a list
CREATE TABLE public.user_list_activity (
  user_id uuid NOT NULL,
  list_id uuid NOT NULL,
  last_opened_at timestamptz,
  last_studied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, list_id)
);

-- Enable RLS
ALTER TABLE public.user_list_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activity"
ON public.user_list_activity
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
ON public.user_list_activity
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
ON public.user_list_activity
FOR UPDATE
USING (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX idx_user_list_activity_user ON public.user_list_activity (user_id, last_studied_at DESC NULLS LAST);