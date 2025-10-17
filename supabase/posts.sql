-- Core video metadata table
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  video_url text not null,
  source text not null check (
    source in ('file', 'youtube', 'instagram', 'tiktok', 'external')
  ),
  categories text[] not null default '{}',
  full_name text,
  view_count bigint not null default 0,
  is_top_rated boolean not null default false,
  uploader_name text not null,
  uploader_email text not null,
  created_at timestamptz not null default now()
);

-- Optional mapping table for Supabase Storage uploads
create table if not exists public.video_files (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  bucket_id text not null default 'ai_videos',
  object_path text not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.videos enable row level security;
alter table public.video_files enable row level security;

-- Public read access to published videos (adjust if you want gated content)
create policy "Public can view videos"
  on public.videos
  for select
  using (true);

-- Creators may insert and manage their own videos
create policy "Creators can insert their videos"
  on public.videos
  for insert
  with check (auth.email() = uploader_email);

create policy "Creators can update their videos"
  on public.videos
  for update
  using (auth.email() = uploader_email)
  with check (auth.email() = uploader_email);

-- Storage file metadata sharing the same access model
create policy "Public can view video_files"
  on public.video_files
  for select
  using (true);

create policy "Creators manage their video files"
  on public.video_files
  for all
  using (
    exists (
      select 1
      from public.videos v
      where v.id = video_files.video_id
        and v.uploader_email = auth.email()
    )
  )
  with check (
    exists (
      select 1
      from public.videos v
      where v.id = video_files.video_id
        and v.uploader_email = auth.email()
    )
  );

-- Recommended: private bucket for uploaded files (run once in Storage)
insert into storage.buckets (id, name, public)
values ('ai_videos', 'ai_videos', false)
on conflict (id) do nothing;
