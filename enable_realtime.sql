-- 📡 Enable Real-time Replication for Reports and Updates

-- 1. Ensure tables have full replica identity (important for real-time)
ALTER TABLE public.reports REPLICA IDENTITY FULL;
ALTER TABLE public.report_updates REPLICA IDENTITY FULL;

-- 2. Add tables to publication safely
-- Note: If 'reports' is already added, this bit might throw an error if run again.
-- So we wrap it in a logic check if manually running, or just run them separately.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'reports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'report_updates'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.report_updates;
    END IF;
END $$;

