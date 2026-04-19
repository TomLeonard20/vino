-- Add columns that were referenced in code but never added to the schema.

alter table wines
  add column if not exists country          text,
  add column if not exists label_image_url  text;
