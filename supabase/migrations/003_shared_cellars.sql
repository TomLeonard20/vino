-- ============================================================
-- Vino — shared cellars
-- Run in your Supabase SQL editor after 001 and 002
-- ============================================================

-- ─── cellars ──────────────────────────────────────────────────
create table public.cellars (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My Cellar',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cellars enable row level security;

create policy "owner can update cellar" on public.cellars
  for update using (owner_id = auth.uid());

-- ─── cellar_members ───────────────────────────────────────────
create table public.cellar_members (
  cellar_id uuid not null references public.cellars(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (cellar_id, user_id)
);

alter table public.cellar_members enable row level security;

create policy "users see own memberships" on public.cellar_members
  for select using (user_id = auth.uid());

-- Now that cellar_members exists, add the select policy on cellars
create policy "members can view their cellar" on public.cellars
  for select using (
    id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

-- Cellar members can also view co-members (so we know who shares the cellar)
create policy "co-members can see each other" on public.cellar_members
  for select using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

-- ─── cellar_invites ───────────────────────────────────────────
create table public.cellar_invites (
  id         uuid primary key default gen_random_uuid(),
  cellar_id  uuid not null references public.cellars(id) on delete cascade,
  code       text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_by    uuid references auth.users(id)
);

alter table public.cellar_invites enable row level security;

-- Any cellar member can create/read invites for their cellar
create policy "members can manage invites" on public.cellar_invites
  for all using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  ) with check (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

-- Anyone authenticated can look up an invite by code (needed for join flow)
create policy "authenticated can read invite by code" on public.cellar_invites
  for select using (auth.uid() is not null);

-- ─── Add cellar_id / added_by to existing tables ─────────────
alter table public.wines          add column if not exists cellar_id uuid references public.cellars(id);
alter table public.cellar_bottles add column if not exists cellar_id uuid references public.cellars(id);
alter table public.cellar_bottles add column if not exists added_by  uuid references auth.users(id);

-- ─── Migrate existing data into personal cellars ──────────────
do $$
declare
  r              record;
  new_cellar_id  uuid;
begin
  for r in (
    select distinct user_id from (
      select user_id from public.wines
      union
      select user_id from public.cellar_bottles
    ) u
    where user_id is not null
  ) loop
    -- Create a personal cellar for this user
    insert into public.cellars (owner_id, name)
    values (r.user_id, 'My Cellar')
    returning id into new_cellar_id;

    -- Add owner membership
    insert into public.cellar_members (cellar_id, user_id, role)
    values (new_cellar_id, r.user_id, 'owner');

    -- Link their wines
    update public.wines
    set cellar_id = new_cellar_id
    where user_id = r.user_id and cellar_id is null;

    -- Link their bottles + set added_by
    update public.cellar_bottles
    set cellar_id = new_cellar_id,
        added_by  = coalesce(added_by, user_id)
    where user_id = r.user_id and cellar_id is null;
  end loop;
end;
$$;

-- ─── Update RLS on wines ──────────────────────────────────────
drop policy if exists "users manage own wines" on public.wines;

create policy "cellar members can select wines" on public.wines
  for select using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "cellar members can insert wines" on public.wines
  for insert with check (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

create policy "cellar members can update wines" on public.wines
  for update using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

create policy "cellar members can delete wines" on public.wines
  for delete using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

-- ─── Update RLS on cellar_bottles ────────────────────────────
drop policy if exists "users manage own bottles" on public.cellar_bottles;

create policy "cellar members can select bottles" on public.cellar_bottles
  for select using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "cellar members can insert bottles" on public.cellar_bottles
  for insert with check (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

create policy "cellar members can update bottles" on public.cellar_bottles
  for update using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

create policy "cellar members can delete bottles" on public.cellar_bottles
  for delete using (
    cellar_id in (select cellar_id from public.cellar_members where user_id = auth.uid())
  );

-- ─── Update RLS on tasting_notes ─────────────────────────────
-- Each person can fully manage their own notes.
-- Cellar members can READ each other's notes (independent reviews).
drop policy if exists "users manage own notes" on public.tasting_notes;

create policy "users manage own notes" on public.tasting_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cellar members can read partner notes" on public.tasting_notes
  for select using (
    wine_id in (
      select w.id from public.wines w
      inner join public.cellar_members cm on cm.cellar_id = w.cellar_id
      where cm.user_id = auth.uid()
    )
  );

-- ─── Atomic join_cellar() stored procedure ────────────────────
-- Called server-side via supabase.rpc('join_cellar', { invite_code: '...' })
-- SECURITY DEFINER so it can bypass RLS for the merge operation.
create or replace function public.join_cellar(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite      record;
  v_cellar_id   uuid;
  v_user_id     uuid;
  v_personal_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the invite row
  select * into v_invite
  from cellar_invites
  where code = invite_code
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invite not found, already used, or expired';
  end if;

  v_cellar_id := v_invite.cellar_id;

  -- If already a member, return the cellar id immediately
  if exists (
    select 1 from cellar_members
    where cellar_id = v_cellar_id and user_id = v_user_id
  ) then
    return v_cellar_id;
  end if;

  -- Find the user's current personal cellar (to merge/remove after)
  select cellar_id into v_personal_id
  from cellar_members
  where user_id = v_user_id
  order by joined_at asc
  limit 1;

  -- Add user as member of the shared cellar
  insert into cellar_members (cellar_id, user_id, role)
  values (v_cellar_id, v_user_id, 'member');

  -- Move the user's wines into the shared cellar
  update wines
  set cellar_id = v_cellar_id
  where user_id = v_user_id;

  -- Move the user's bottles into the shared cellar
  update cellar_bottles
  set cellar_id = v_cellar_id,
      added_by  = coalesce(added_by, user_id)
  where user_id = v_user_id;

  -- Remove the user's now-superseded personal cellar
  if v_personal_id is not null and v_personal_id != v_cellar_id then
    delete from cellar_members where cellar_id = v_personal_id and user_id = v_user_id;
    delete from cellars where id = v_personal_id and owner_id = v_user_id;
  end if;

  -- Mark invite as used
  update cellar_invites
  set used_at = now(), used_by = v_user_id
  where id = v_invite.id;

  return v_cellar_id;
end;
$$;

-- ─── Indexes ──────────────────────────────────────────────────
create index if not exists cellar_members_user_id_idx on public.cellar_members(user_id);
create index if not exists cellar_members_cellar_id_idx on public.cellar_members(cellar_id);
create index if not exists wines_cellar_id_idx on public.wines(cellar_id);
create index if not exists bottles_cellar_id_idx on public.cellar_bottles(cellar_id);
