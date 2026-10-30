-- Persist one shared color for each department instead of relying on a
-- browser-local preference. Existing departments receive a stable palette
-- color derived from their name.
ALTER TABLE "Department"
ADD COLUMN "color" VARCHAR(16) NOT NULL DEFAULT 'blue';

UPDATE "Department"
SET "color" = CASE
  WHEN LOWER(TRIM("name")) = 'administration' THEN 'blue'
  ELSE (ARRAY[
    'violet',
    'pink',
    'orange',
    'teal',
    'amber',
    'slate',
    'green',
    'red',
    'brown',
    'cyan'
  ])[MOD(GET_BYTE(DECODE(MD5(LOWER(TRIM("name"))), 'hex'), 0), 10) + 1]
END;

ALTER TABLE "Department"
ADD CONSTRAINT "Department_color_check"
CHECK ("color" IN (
  'blue',
  'violet',
  'pink',
  'orange',
  'teal',
  'amber',
  'slate',
  'green',
  'red',
  'brown',
  'cyan'
));
