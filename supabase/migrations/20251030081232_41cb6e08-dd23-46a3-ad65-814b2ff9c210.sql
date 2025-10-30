-- Add videos and images columns to user_tokens
ALTER TABLE public.user_tokens 
ADD COLUMN videos INTEGER NOT NULL DEFAULT 0,
ADD COLUMN images INTEGER NOT NULL DEFAULT 0;

-- Add videos and images columns to purchases
ALTER TABLE public.purchases 
ADD COLUMN videos INTEGER NOT NULL DEFAULT 0,
ADD COLUMN images INTEGER NOT NULL DEFAULT 0;

-- Update existing users with trial videos and images (2 videos + 5 images from the Starter package)
UPDATE public.user_tokens 
SET videos = 2, images = 5 
WHERE tokens = 20;