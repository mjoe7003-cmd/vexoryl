create table if not exists public.stream_viewer_sessions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  region text not null default 'unknown',
  device_type text not null default 'unknown',
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('chat', 'director_trigger', 'reaction', 'milestone')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_viewer_sessions_stream_joined on public.stream_viewer_sessions (stream_id, joined_at desc);
create index if not exists idx_engagement_events_stream_created on public.engagement_events (stream_id, created_at desc);

create or replace function public.creator_analytics(creator_id_input uuid, window_start timestamptz default now() - interval '30 days')
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with creator_streams as (
  select id from public.streams where creator_id = creator_id_input
), sessions as (
  select svs.* from public.stream_viewer_sessions svs join creator_streams cs on cs.id = svs.stream_id where svs.joined_at >= window_start
), revenue as (
  select t.type, coalesce(sum(t.amount) filter (where t.status = 'completed'), 0) as amount
  from public.transactions t where t.receiver_id = creator_id_input and t.created_at >= window_start group by t.type
), hourly as (
  select date_trunc('hour', ee.created_at) as hour,
    count(*) filter (where ee.event_type = 'chat') as chat,
    count(*) filter (where ee.event_type = 'director_trigger') as director
  from public.engagement_events ee join creator_streams cs on cs.id = ee.stream_id
  where ee.created_at >= window_start group by 1 order by 1
)
select jsonb_build_object(
  'concurrent_viewer_peak', coalesce((select max((select count(*) from sessions active where active.joined_at <= points.point and (active.left_at is null or active.left_at > points.point))) from (select joined_at as point from sessions) points), 0),
  'viewer_regions', coalesce((select jsonb_agg(jsonb_build_object('name', region, 'viewers', viewers)) from (select region, count(*) as viewers from sessions group by region order by viewers desc) regions), '[]'::jsonb),
  'device_types', coalesce((select jsonb_agg(jsonb_build_object('name', device_type, 'viewers', viewers)) from (select device_type, count(*) as viewers from sessions group by device_type order by viewers desc) devices), '[]'::jsonb),
  'revenue', coalesce((select jsonb_object_agg(type, amount) from revenue), '{}'::jsonb),
  'stream_duration_trends', coalesce((select jsonb_agg(jsonb_build_object('stream', title, 'minutes', greatest(1, extract(epoch from (coalesce(updated_at, now()) - created_at) / 60)::int))) from public.streams where creator_id = creator_id_input and created_at >= window_start), '[]'::jsonb),
  'engagement_heatmap', coalesce((select jsonb_agg(jsonb_build_object('hour', hour, 'chat', chat, 'director', director)) from hourly), '[]'::jsonb)
);
$$;

alter table public.stream_viewer_sessions enable row level security;
alter table public.engagement_events enable row level security;
create policy "Creators can view their session analytics" on public.stream_viewer_sessions for select to authenticated using (exists (select 1 from public.streams where streams.id = stream_id and streams.creator_id = auth.uid()));
create policy "Creators can view their engagement analytics" on public.engagement_events for select to authenticated using (exists (select 1 from public.streams where streams.id = stream_id and streams.creator_id = auth.uid()));
