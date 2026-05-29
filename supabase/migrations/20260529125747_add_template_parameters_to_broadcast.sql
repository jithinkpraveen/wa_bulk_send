-- Stores the resolved variable bindings for a broadcast's message template.
-- Shape (see lib/bulk-send/template-parameters.ts):
-- {
--   "header":  [{ "kind": "static" | "field", "value": "..." }],
--   "body":    [{ "kind": "static" | "field", "value": "..." }],
--   "buttons": [{ "index": 0, "sub_type": "url", "kind": "static", "value": "..." }]
-- }
-- "field" bindings reference a contact column (e.g. "name", "number") and are
-- resolved per-recipient at send time; "static" values are the same for everyone.
alter table "public"."broadcast"
  add column if not exists "template_parameters" jsonb;
