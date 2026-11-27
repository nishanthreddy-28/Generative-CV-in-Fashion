-- Review and apply to the integration project. Does not migrate local test users.
begin;
create table public.dd_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);
create table public.dd_items (
  id text primary key check (id ~ '^[a-f0-9]{32}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_sha256 text not null check (upload_sha256 ~ '^[a-f0-9]{64}$'),
  data jsonb not null,
  measurements jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index dd_exact_upload on public.dd_items(user_id,upload_sha256) where not is_archived;
create index dd_active_items on public.dd_items(user_id,is_archived);
create table public.dd_conversations (
  id text primary key check (id ~ '^[a-f0-9]{32}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 0,
  state jsonb not null
);
create table public.dd_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  outfit_id text not null,
  liked boolean not null,
  primary key(user_id,outfit_id)
);
create table public.dd_preview_jobs (
  id text primary key check (id ~ '^[a-f0-9]{32}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
do $$ declare name text; begin
  foreach name in array array['dd_profiles','dd_items','dd_conversations','dd_feedback','dd_preview_jobs'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('grant select,insert,update,delete on public.%I to authenticated', name);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)', name);
  end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('dd-private','dd-private',false,15728640,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
create policy dd_private_owner on storage.objects for all to authenticated
using (bucket_id='dd-private' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='dd-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
