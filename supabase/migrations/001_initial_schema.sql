-- ============================================================
-- Vino — initial schema
-- Run this in your Supabase SQL editor (or via supabase db push)
-- ============================================================

-- Enable Row Level Security on all tables
-- Every table is scoped to auth.uid() so users only see their own data.

-- ─── wines ───────────────────────────────────────────────────
create table public.wines (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  producer      text not null default '',
  region        text not null default '',
  appellation   text not null default '',
  vintage       integer,
  grapes        text[] not null default '{}',
  critic_score  integer check (critic_score between 0 and 100),
  db_source     text,
  created_at    timestamptz not null default now()
);

alter table public.wines enable row level security;
create policy "users manage own wines" on public.wines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── flavour_profiles ────────────────────────────────────────
create table public.flavour_profiles (
  id          uuid primary key default gen_random_uuid(),
  wine_id     uuid not null unique references public.wines(id) on delete cascade,
  body        integer not null default -1 check (body between -1 and 100),
  tannins     integer not null default -1 check (tannins between -1 and 100),
  acidity     integer not null default -1 check (acidity between -1 and 100),
  alcohol     integer not null default -1 check (alcohol between -1 and 100),
  sweetness   integer not null default -1 check (sweetness between -1 and 100),
  fruit       integer not null default -1 check (fruit between -1 and 100),
  oak         integer not null default -1 check (oak between -1 and 100),
  finish      integer not null default -1 check (finish between -1 and 100)
);

alter table public.flavour_profiles enable row level security;
create policy "users manage own flavour profiles" on public.flavour_profiles
  for all using (
    auth.uid() = (select user_id from public.wines where id = wine_id)
  ) with check (
    auth.uid() = (select user_id from public.wines where id = wine_id)
  );

-- ─── cellar_bottles ──────────────────────────────────────────
create type public.wine_type as enum ('Red', 'White', 'Rosé', 'Champagne');
create type public.currency  as enum ('AUD', 'USD', 'GBP', 'EUR', 'JPY');

create table public.cellar_bottles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  wine_id             uuid not null references public.wines(id) on delete cascade,
  wine_type           public.wine_type not null default 'Red',
  quantity            integer not null default 1 check (quantity >= 0),
  purchase_price      numeric(10,2),
  purchase_currency   public.currency not null default 'AUD',
  purchase_date       date,
  drink_from          integer,  -- year
  peak                integer,  -- year
  drink_to            integer,  -- year
  market_price        numeric(10,2),
  market_currency     public.currency not null default 'AUD',
  added_at            timestamptz not null default now()
);

alter table public.cellar_bottles enable row level security;
create policy "users manage own bottles" on public.cellar_bottles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── tasting_notes ───────────────────────────────────────────
create type public.tasting_mode    as enum ('quick', 'wset');
create type public.wset_quality    as enum ('Faulty','Poor','Acceptable','Good','Very good','Outstanding');
create type public.wset_readiness  as enum ('Too young','Drink now','At peak','Fading');

create table public.tasting_notes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  wine_id               uuid not null references public.wines(id) on delete cascade,
  tasted_at             timestamptz not null default now(),
  mode                  public.tasting_mode not null default 'quick',
  score                 integer not null check (score between 80 and 100),
  stars                 integer not null check (stars between 1 and 5),
  free_text             text not null default '',
  nose_tags             text[] not null default '{}',
  palate_tags           text[] not null default '{}',
  -- WSET appearance
  appearance_clarity    text,
  appearance_intensity  text,
  appearance_colour     text,
  -- WSET nose
  nose_condition        text,
  nose_intensity        text,
  nose_development      text,
  -- WSET palate
  palate_sweetness      text,
  palate_acidity        integer check (palate_acidity between 0 and 100),
  palate_tannin         integer check (palate_tannin between 0 and 100),
  palate_alcohol        integer check (palate_alcohol between 0 and 100),
  palate_body           integer check (palate_body between 0 and 100),
  palate_finish         integer check (palate_finish between 0 and 100),
  -- WSET conclusions
  quality               public.wset_quality,
  readiness             public.wset_readiness
);

alter table public.tasting_notes enable row level security;
create policy "users manage own notes" on public.tasting_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── indexes ─────────────────────────────────────────────────
create index on public.wines(user_id);
create index on public.cellar_bottles(user_id);
create index on public.cellar_bottles(wine_id);
create index on public.tasting_notes(user_id);
create index on public.tasting_notes(wine_id);
create index on public.tasting_notes(score desc);
