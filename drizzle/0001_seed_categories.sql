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
	"label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "emoji" = EXCLUDED."emoji";
