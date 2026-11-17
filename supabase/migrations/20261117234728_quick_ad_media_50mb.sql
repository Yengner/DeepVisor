-- Quick ad uploads go straight from the browser to this private bucket with one-time links,
-- so files are no longer limited by the 4.5 MB serverless request cap. 50 MiB is the project's
-- per-file storage limit; the app enforces 30 MB for photos and 50 MB for videos.
update storage.buckets set file_size_limit = 52428800 where id = 'assistant-draft-media';
