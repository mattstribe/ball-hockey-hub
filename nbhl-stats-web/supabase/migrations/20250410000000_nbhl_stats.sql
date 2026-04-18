-- NBHL historical stats (skaters + goalies). Run in Supabase SQL Editor or via CLI.

create table skating_stats (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  segment text not null check (segment in ('regular', 'playoffs', 'mylec')),
  rank int,
  player_name text not null,
  jersey text,
  team_name text not null,
  division text,
  tier text,
  gp int,
  g int,
  a int,
  pts int,
  pim numeric,
  ppg numeric,
  imported_at timestamptz not null default now()
);

create index skating_stats_season_segment_idx on skating_stats (season, segment);
create index skating_stats_team_name_idx on skating_stats (team_name);

create table goalie_stats (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  segment text not null check (segment in ('regular', 'playoffs', 'mylec')),
  goalie_name text not null,
  jersey text,
  team_name text not null,
  division text,
  tier text,
  gp int,
  min_played text,
  w int,
  l int,
  ties int,
  shutouts int,
  ga int,
  gaa numeric,
  sv int,
  sv_pct numeric,
  imported_at timestamptz not null default now()
);

create index goalie_stats_season_segment_idx on goalie_stats (season, segment);
create index goalie_stats_team_name_idx on goalie_stats (team_name);

alter table skating_stats enable row level security;
alter table goalie_stats enable row level security;

create policy "Public read skating_stats"
  on skating_stats for select
  to anon, authenticated
  using (true);

create policy "Public read goalie_stats"
  on goalie_stats for select
  to anon, authenticated
  using (true);

-- Service role bypasses RLS for imports (use service role key only server-side / local script).
