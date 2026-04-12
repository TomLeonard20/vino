-- ============================================================
-- Vino — wine catalogue (global, read-only reference data)
-- Sourced from WineEnthusiast / winemag 130k dataset
-- Run this in your Supabase SQL editor
-- ============================================================

-- ─── table ───────────────────────────────────────────────────
create table public.wine_catalogue (
  id          bigint generated always as identity primary key,
  title       text not null,          -- full title e.g. "Château Margaux 2015 (Margaux)"
  winery      text not null default '',
  variety     text not null default '',  -- grape variety / blend
  country     text not null default '',
  province    text not null default '',
  region      text not null default '',
  vintage     integer,                -- parsed from title
  points      integer,               -- critic score 80-100
  price_usd   numeric(10,2),         -- original USD price
  description text not null default ''
);

-- No RLS — this is global reference data, readable by all authenticated users
alter table public.wine_catalogue enable row level security;
create policy "catalogue readable by authenticated users"
  on public.wine_catalogue for select
  using (auth.role() = 'authenticated');

-- ─── full-text search index ──────────────────────────────────
-- tsvector combining title + winery + variety for fast search
alter table public.wine_catalogue
  add column search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title,   '') || ' ' ||
      coalesce(winery,  '') || ' ' ||
      coalesce(variety, '') || ' ' ||
      coalesce(country, '') || ' ' ||
      coalesce(region,  '')
    )
  ) stored;

create index wine_catalogue_fts_idx
  on public.wine_catalogue using gin(search_vector);

-- Also index the most-queried columns individually
create index wine_catalogue_winery_idx  on public.wine_catalogue (lower(winery));
create index wine_catalogue_variety_idx on public.wine_catalogue (lower(variety));
create index wine_catalogue_country_idx on public.wine_catalogue (lower(country));
create index wine_catalogue_vintage_idx on public.wine_catalogue (vintage);
