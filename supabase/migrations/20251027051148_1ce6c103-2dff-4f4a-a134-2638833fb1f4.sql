-- Create storage bucket for video generation images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload their own images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to images
CREATE POLICY "Public images are accessible to everyone"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);