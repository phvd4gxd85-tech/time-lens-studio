-- Make the videos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'videos';

-- Drop the public SELECT policy that allows anyone to read
DROP POLICY IF EXISTS "Public images are accessible to everyone" ON storage.objects;

-- Add a SELECT policy so authenticated users can read their own files
CREATE POLICY "Users can read own video files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
