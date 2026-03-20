-- Push Subscriptions Table
-- This table stores browser/device specific Web Push subscription objects.
-- The endpoint and keys are required to send push messages securely to the user's device.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);

-- Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own subscriptions
CREATE POLICY "Users can insert their own subscriptions"
ON push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscriptions"
ON push_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
ON push_subscriptions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- System can read all subscriptions for dispatching notifications 
-- (Assuming we use a service role key for dispatch)
