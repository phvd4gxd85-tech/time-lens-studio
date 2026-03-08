
CREATE POLICY "Allow public uploads to trial-input folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = 'trial-input');
