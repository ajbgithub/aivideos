create extension if not exists "pgcrypto";

-- Community video posts table
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  video_url text,
  source text not null check (
    source in ('file', 'youtube', 'instagram', 'tiktok', 'external')
  ),
  storage_object_path text,
  storage_bucket_id text not null default 'ai_videos',
  categories text[] not null default '{}',
  full_name text,
  view_count bigint not null default 0,
  is_top_rated boolean not null default false,
  uploader_name text not null,
  uploader_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_media_present check (num_nonnulls(video_url, storage_object_path) >= 1),
  constraint video_categories_limit check (cardinality(categories) <= 3)
);

-- Bring older schemas up to date
alter table public.videos
  alter column video_url drop not null;

alter table public.videos
  add column if not exists storage_object_path text;

alter table public.videos
  add column if not exists storage_bucket_id text;

update public.videos
set storage_bucket_id = 'ai_videos'
where storage_bucket_id is null;

alter table public.videos
  alter column storage_bucket_id set not null;

alter table public.videos
  alter column storage_bucket_id set default 'ai_videos';

alter table public.videos
  add column if not exists updated_at timestamptz not null default now();

alter table public.videos
  drop constraint if exists video_media_present;

alter table public.videos
  add constraint video_media_present check (num_nonnulls(video_url, storage_object_path) >= 1);

alter table public.videos
  drop constraint if exists video_categories_limit;

alter table public.videos
  add constraint video_categories_limit check (cardinality(categories) <= 3);

create or replace function public.set_videos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_videos_updated_at on public.videos;

create trigger set_videos_updated_at
before update on public.videos
for each row
execute function public.set_videos_updated_at();

-- Enable Row Level Security
alter table public.videos enable row level security;

drop policy if exists "Public can view videos" on public.videos;
create policy "Public can view videos"
  on public.videos
  for select
  using (true);

drop policy if exists "Creators can insert their videos" on public.videos;
create policy "Creators can insert their videos"
  on public.videos
  for insert
  with check (auth.email() = uploader_email);

drop policy if exists "Creators can update their videos" on public.videos;
create policy "Creators can update their videos"
  on public.videos
  for update
  using (auth.email() = uploader_email)
  with check (auth.email() = uploader_email);

drop policy if exists "Creators can delete their videos" on public.videos;
create policy "Creators can delete their videos"
  on public.videos
  for delete
  using (auth.email() = uploader_email);

-- Storage bucket for uploaded files
insert into storage.buckets (id, name, public)
values ('ai_videos', 'ai_videos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public read access for ai_videos" on storage.objects;
create policy "Public read access for ai_videos"
  on storage.objects
  for select
  using (bucket_id = 'ai_videos');

drop policy if exists "Authenticated users upload ai_videos" on storage.objects;
create policy "Authenticated users upload ai_videos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'ai_videos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Creators manage their ai_videos uploads" on storage.objects;
create policy "Creators manage their ai_videos uploads"
  on storage.objects
  for update
  using (
    bucket_id = 'ai_videos'
    and auth.uid() = owner
  )
  with check (
    bucket_id = 'ai_videos'
    and auth.uid() = owner
  );

drop policy if exists "Creators delete their ai_videos uploads" on storage.objects;
create policy "Creators delete their ai_videos uploads"
  on storage.objects
  for delete
  using (
    bucket_id = 'ai_videos'
    and auth.uid() = owner
  );
