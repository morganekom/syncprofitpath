-- ================================================================
-- Feature announcements + guided tour progress
-- Additive only: creates two new tables. Nothing existing is touched.
-- ================================================================

-- 1. Announcements written by admin (Settings > Announcements)
create table if not exists public.announcements (
    id          uuid primary key default gen_random_uuid(),
    title       text not null,
    body        text not null,
    link_url    text,
    link_label  text,
    steps       jsonb not null default '[]'::jsonb,   -- [{target, title, text}, ...]
    is_active   boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Any logged-in user can read active announcements
create policy "announcements read active"
    on public.announcements for select
    to authenticated
    using (is_active = true);

-- Admins can read, create, edit and delete everything
create policy "announcements admin all"
    on public.announcements for all
    to authenticated
    using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
    with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));


-- 2. Per-user record of what they have already seen
--    key = 'welcome'            -> finished/skipped the welcome tour
--    key = 'ann:<announcement>' -> dismissed or viewed that announcement
create table if not exists public.tour_progress (
    user_id  uuid not null references public.users(id) on delete cascade,
    key      text not null,
    done_at  timestamptz not null default now(),
    primary key (user_id, key)
);

alter table public.tour_progress enable row level security;

create policy "tour_progress own select"
    on public.tour_progress for select
    to authenticated
    using (user_id = auth.uid());

create policy "tour_progress own insert"
    on public.tour_progress for insert
    to authenticated
    with check (user_id = auth.uid());

create policy "tour_progress own delete"
    on public.tour_progress for delete
    to authenticated
    using (user_id = auth.uid());
