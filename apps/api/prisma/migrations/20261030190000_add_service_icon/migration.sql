ALTER TABLE "Service"
ADD COLUMN "iconKey" VARCHAR(32) NOT NULL DEFAULT 'sparkles';

UPDATE "Service"
SET "iconKey" = CASE
    WHEN LOWER("name") ~ '(social|community)' THEN 'social'
    WHEN LOWER("name") ~ '(advert|ads|paid|marketing)' THEN 'advertising'
    WHEN LOWER("name") ~ '(customer|support|business)' THEN 'business'
    WHEN LOWER("name") ~ '(video|film|media)' THEN 'video'
    WHEN LOWER("name") ~ '(website|web|development|software)' THEN 'code'
    WHEN LOWER("name") ~ '(search|seo)' THEN 'search'
    WHEN LOWER("name") ~ '(email|newsletter)' THEN 'email'
    WHEN LOWER("name") ~ '(graphic|design|brand|creative)' THEN 'design'
    ELSE 'sparkles'
END;
