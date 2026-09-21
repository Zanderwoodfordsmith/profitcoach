-- Campaign voice/video notes need more headroom than chat attachments (15MB).
-- Inbox still enforces 15MB in app code; the bucket cap is the storage ceiling.

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'audio/mp4',
    'audio/m4a',
    'audio/mpeg',
    'audio/webm',
    'audio/ogg',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
where id = 'messaging-attachments';
