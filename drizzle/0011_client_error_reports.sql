CREATE TABLE "client_error_reports" (
  "id" uuid PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "message" text NOT NULL,
  "stack" text,
  "path" text,
  "release" text
);
--> statement-breakpoint
CREATE INDEX "client_error_reports_user_id_created_at_idx"
  ON "client_error_reports" ("user_id", "created_at");
