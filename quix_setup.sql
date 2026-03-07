-- 🇮🇳 ConnectSphere Quix (Short Videos) Schema

-- 1. Quix Table
CREATE TABLE IF NOT EXISTS public.quix (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    likes_count INT DEFAULT 0,
    reposts_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Quix Likes
CREATE TABLE IF NOT EXISTS public.quix_likes (
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    quix_id UUID REFERENCES public.quix(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, quix_id)
);

-- 3. Quix Bookmarks (Save)
CREATE TABLE IF NOT EXISTS public.quix_bookmarks (
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    quix_id UUID REFERENCES public.quix(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, quix_id)
);

-- 4. Reposts
CREATE TABLE IF NOT EXISTS public.quix_reposts (
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    quix_id UUID REFERENCES public.quix(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, quix_id)
);

-- 5. Link Stories to Quix
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='quix_id') THEN
        ALTER TABLE public.stories ADD COLUMN quix_id UUID REFERENCES public.quix(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Link Messages to Quix (for sharing)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='quix_id') THEN
        ALTER TABLE public.messages ADD COLUMN quix_id UUID REFERENCES public.quix(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.quix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quix_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quix_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quix_reposts ENABLE ROW LEVEL SECURITY;

-- Policies for Quix
DROP POLICY IF EXISTS "Quix are viewable by everyone" ON public.quix;
CREATE POLICY "Quix are viewable by everyone" ON public.quix FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own quix" ON public.quix;
CREATE POLICY "Users can insert their own quix" ON public.quix FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own quix" ON public.quix;
CREATE POLICY "Users can delete their own quix" ON public.quix FOR DELETE USING (auth.uid() = user_id);

-- Policies for Quix Likes
DROP POLICY IF EXISTS "Quix likes are viewable by everyone" ON public.quix_likes;
CREATE POLICY "Quix likes are viewable by everyone" ON public.quix_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can like quix" ON public.quix_likes;
CREATE POLICY "Users can like quix" ON public.quix_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unlike quix" ON public.quix_likes;
CREATE POLICY "Users can unlike quix" ON public.quix_likes FOR DELETE USING (auth.uid() = user_id);

-- Policies for Quix Bookmarks
DROP POLICY IF EXISTS "Users can view their own quix bookmarks" ON public.quix_bookmarks;
CREATE POLICY "Users can view their own quix bookmarks" ON public.quix_bookmarks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can bookmark quix" ON public.quix_bookmarks;
CREATE POLICY "Users can bookmark quix" ON public.quix_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unbookmark quix" ON public.quix_bookmarks;
CREATE POLICY "Users can unbookmark quix" ON public.quix_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Policies for Reposts
DROP POLICY IF EXISTS "Reposts are viewable by everyone" ON public.quix_reposts;
CREATE POLICY "Reposts are viewable by everyone" ON public.quix_reposts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can repost quix" ON public.quix_reposts;
CREATE POLICY "Users can repost quix" ON public.quix_reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove repost" ON public.quix_reposts;
CREATE POLICY "Users can remove repost" ON public.quix_reposts FOR DELETE USING (auth.uid() = user_id);

-- Trigger for likes count (Optional but good for performance)
CREATE OR REPLACE FUNCTION public.handle_quix_like()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.quix SET likes_count = likes_count + 1 WHERE id = NEW.quix_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.quix SET likes_count = likes_count - 1 WHERE id = OLD.quix_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_quix_like ON public.quix_likes;
CREATE TRIGGER on_quix_like
    AFTER INSERT OR DELETE ON public.quix_likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_quix_like();
