ALTER TABLE "ProjectShowcaseEntry"
  ADD COLUMN "galleryLayout" TEXT NOT NULL DEFAULT 'single-wide',
  ADD COLUMN "additionalImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "ProjectShowcaseEntry_additionalImages_limit" CHECK (cardinality("additionalImages") <= 4);
