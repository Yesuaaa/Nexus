-- The earlier draft stored image data directly. Service images now live in
-- Supabase Storage, so discard draft data URLs and retain only object paths.
UPDATE "Service"
SET "imageDataUrl" = NULL
WHERE "imageDataUrl" LIKE 'data:image/%';

ALTER TABLE "Service" RENAME COLUMN "imageDataUrl" TO "imagePath";
