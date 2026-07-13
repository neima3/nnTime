-- 0001_seed_categories: canonical 6-category seed data.
--
-- Categories are per-user (each user owns 6 rows on signup, Phase 1C). This
-- migration records the CANONICAL seed values in a dedicated table so the
-- signup seeding is data-driven and idempotent, rather than hardcoded in app
-- code. The six keys match the design tokens in src/app/globals.css exactly:
-- peach, butter, mint, sky, lilac, rose. The immutable `key` is the semantic
-- identity; `label` is the editable display name (the seed default).
--
-- `key` is what the color/icon system keys off — it must never change and there
-- are exactly six. A deleted category's items fall back to a canonical key
-- (service-layer rule, Phase 1C).

CREATE TABLE IF NOT EXISTS "category_seed" (
	"key" text PRIMARY KEY,
	"label" text NOT NULL,
	"sort_order" smallint NOT NULL,
	"emoji" text
);

INSERT INTO "category_seed" ("key", "label", "sort_order", "emoji") VALUES
	('peach',  'Food',     1, '🍑'),
	('butter', 'Routine',  2, '🌤️'),
	('mint',   'Movement', 3, '🌿'),
	('sky',    'Work',     4, '💼'),
	('lilac',  'Focus',    5, '🎨'),
	('rose',   'People',   6, '💗')
ON CONFLICT ("key") DO UPDATE SET
	"label" = EXCLUDED."label",
	"sort_order" = EXCLUDED."sort_order",
	"emoji" = EXCLUDED."emoji";
