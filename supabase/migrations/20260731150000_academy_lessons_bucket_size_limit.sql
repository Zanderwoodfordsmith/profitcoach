-- Legacy academy videos can be 500MB–2GB+; default Storage limit is 50MB.
-- Also set Dashboard → Storage → Settings → Global file size limit to at least 2 GB (Pro plan).
update storage.buckets
set file_size_limit = 2147483648
where id = 'academy-lessons';
