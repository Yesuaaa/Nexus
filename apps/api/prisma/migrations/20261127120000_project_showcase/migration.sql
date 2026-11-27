CREATE TABLE "ProjectShowcaseEntry" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "client" VARCHAR(120) NOT NULL,
  "type" VARCHAR(100) NOT NULL,
  "year" INTEGER,
  "description" VARCHAR(4000) NOT NULL,
  "image" VARCHAR(1000) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 100,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "fictional" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProjectShowcaseEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectShowcaseEntry_slug_key" ON "ProjectShowcaseEntry"("slug");
CREATE INDEX "ProjectShowcaseEntry_published_position_slug_idx" ON "ProjectShowcaseEntry"("published", "position", "slug");
ALTER TABLE "ProjectShowcaseEntry" ENABLE ROW LEVEL SECURITY;

INSERT INTO "ProjectShowcaseEntry"
  ("id", "slug", "name", "client", "type", "description", "image", "position", "published", "featured", "fictional")
VALUES
  ('f364a70b-6ca3-4b1c-88f0-0887bbd62b01', 'jollybee', 'Jollybee', 'Jollybee', 'Brand campaign',
   'A fictional brand campaign that explores a consistent visual identity across printed and digital materials.',
   '/landing/converyn-product-discover.webp', 10, true, true, true),
  ('f364a70b-6ca3-4b1c-88f0-0887bbd62b02', 'mang-inasalan', 'Mang Inasalan', 'Mang Inasalan', 'Digital experience',
   'A fictional digital experience that uses bold imagery and a clear visual hierarchy to introduce a brand online.',
   '/landing/converyn-product-create.webp', 20, true, true, true),
  ('f364a70b-6ca3-4b1c-88f0-0887bbd62b03', 'chowkingdom', 'Chowkingdom', 'Chowkingdom', 'Visual storytelling',
   'A fictional visual system that carries a recognizable brand story from desktop to mobile.',
   '/landing/converyn-product-connect.webp', 30, true, true, true),
  ('f364a70b-6ca3-4b1c-88f0-0887bbd62b04', 'sari-sm', 'Sari-SM', 'Sari-SM', 'Creative campaign',
   'A fictional creative campaign that brings a retail concept to life through art direction and design.',
   '/landing/converyn-team-design.webp', 40, true, false, true);
