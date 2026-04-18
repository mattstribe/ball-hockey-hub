-- Rename skater table to player_stats (app + import expect this name).
-- Safe if already renamed or if only player_stats exists.

do $$
begin
  if to_regclass('public.skating_stats') is not null
     and to_regclass('public.player_stats') is null
  then
    alter table public.skating_stats rename to player_stats;
  end if;
end;
$$;
