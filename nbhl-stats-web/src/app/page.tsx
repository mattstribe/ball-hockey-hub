import { createSupabaseServerClient } from "@/lib/supabase/server";

function cell(v: unknown): string {
  if (v == null) return "—";
  const s = String(v);
  return s === "" ? "—" : s;
}

type Segment = "regular" | "playoffs" | "mylec" | "all";

function parseSegment(s: string | undefined): Segment {
  if (s === "playoffs" || s === "mylec" || s === "all") return s;
  return "regular";
}

function parseYear(s: string | undefined): number | "all" {
  if (s === "all") return "all";
  const n = Number.parseInt(s ?? "", 10);
  if (n >= 2000 && n <= 2100) return n;
  return 2023;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const yearParam = typeof sp.year === "string" ? sp.year : undefined;
  const segmentParam = typeof sp.segment === "string" ? sp.segment : undefined;
  const teamParam = typeof sp.team === "string" ? sp.team : "";
  const roleParam = typeof sp.role === "string" ? sp.role : "skater";

  const year = parseYear(yearParam);
  const segment = parseSegment(segmentParam);
  const role = roleParam === "goalie" ? "goalie" : "skater";

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-foreground">NBHL stats</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Add{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-sm dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-sm dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          to <code className="text-sm">.env.local</code>, then restart{" "}
          <code className="text-sm">next dev</code>.
        </p>
      </div>
    );
  }

  const table = role === "skater" ? "player_stats" : "goalie_stats";

  const { data: seasonRows } = await supabase.from(table).select("season");
  const years = [
    ...new Set((seasonRows ?? []).map((r) => r.season as number)),
  ].sort((a, b) => a - b);

  const yearForTeams = year === "all" ? undefined : year;

  let teamsQuery = supabase.from(table).select("team_name");
  if (yearForTeams != null) teamsQuery = teamsQuery.eq("season", yearForTeams);
  if (segment !== "all") teamsQuery = teamsQuery.eq("segment", segment);
  const { data: teamRows } = await teamsQuery;
  const teams = [
    ...new Set((teamRows ?? []).map((r) => r.team_name as string)),
  ].sort((a, b) => a.localeCompare(b));

  let dataQuery =
    role === "skater"
      ? supabase
          .from("player_stats")
          .select(
            "rank,player_name,jersey,team_name,division,tier,gp,g,a,pts,pim,ppg,season,segment",
          )
      : supabase
          .from("goalie_stats")
          .select(
            "goalie_name,jersey,team_name,division,tier,gp,min_played,w,l,ties,shutouts,ga,gaa,sv,sv_pct,season,segment",
          );

  if (year !== "all") dataQuery = dataQuery.eq("season", year);
  if (segment !== "all") dataQuery = dataQuery.eq("segment", segment);
  if (teamParam) dataQuery = dataQuery.eq("team_name", teamParam);

  if (role === "skater") {
    dataQuery = dataQuery
      .order("pts", { ascending: false, nullsFirst: false })
      .order("gp", { ascending: true });
  } else {
    dataQuery = dataQuery
      .order("gaa", { ascending: true, nullsFirst: false })
      .order("gp", { ascending: false });
  }

  const { data: rows, error } = await dataQuery.limit(2000);

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">NBHL stats</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Season leaderboards from exported sheets (prototype).
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <form
          className="mb-8 flex flex-wrap items-end gap-4"
          method="get"
          action="/"
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            Season year
            <select
              name="year"
              defaultValue={year === "all" ? "all" : String(year)}
              className="min-w-[8rem] rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              {years.length === 0 ? (
                <option value="2023">2023</option>
              ) : (
                years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))
              )}
              <option value="all">All years</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Segment
            <select
              name="segment"
              defaultValue={segment}
              className="min-w-[10rem] rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="regular">Regular season</option>
              <option value="playoffs">Playoffs</option>
              <option value="mylec">Mylec Cup</option>
              <option value="all">All segments</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Team
            <select
              name="team"
              defaultValue={teamParam}
              className="min-w-[14rem] max-w-[20rem] rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Table
            <select
              name="role"
              defaultValue={role}
              className="min-w-[8rem] rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="skater">Players</option>
              <option value="goalie">Goalies</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Apply
          </button>
        </form>

        {error && (
          <p className="mb-4 text-red-600 dark:text-red-400">
            {error.message} — run the SQL migration in Supabase and import CSVs (
            <code className="text-sm">npm run import:nbhl</code>).
          </p>
        )}

        {!error && rows && rows.length === 0 && (
          <p className="text-zinc-600 dark:text-zinc-400">
            No rows for these filters. If the database is empty, apply{" "}
            <code className="text-sm">supabase/migrations/</code> (SQL files, oldest first){" "}
            in the Supabase SQL editor, set{" "}
            <code className="text-sm">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
            <code className="text-sm">.env.local</code>, then run{" "}
            <code className="text-sm">npm run import:nbhl</code>.
          </p>
        )}

        {!error && rows && rows.length > 0 && role === "skater" && (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-800/50">
                  {year === "all" && (
                    <th className="px-3 py-2 font-semibold">Year</th>
                  )}
                  {segment === "all" && (
                    <th className="px-3 py-2 font-semibold">Segment</th>
                  )}
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Player</th>
                  <th className="px-3 py-2 font-semibold">Tm</th>
                  <th className="px-3 py-2 font-semibold">Div</th>
                  <th className="px-3 py-2 font-semibold">Tier</th>
                  <th className="px-3 py-2 font-semibold text-right">GP</th>
                  <th className="px-3 py-2 font-semibold text-right">G</th>
                  <th className="px-3 py-2 font-semibold text-right">A</th>
                  <th className="px-3 py-2 font-semibold text-right">PTS</th>
                  <th className="px-3 py-2 font-semibold text-right">PIM</th>
                  <th className="px-3 py-2 font-semibold text-right">PPG</th>
                </tr>
              </thead>
              <tbody>
                {(rows as Record<string, unknown>[]).map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-100 dark:border-zinc-800/80"
                  >
                    {year === "all" && (
                      <td className="px-3 py-1.5 tabular-nums">
                        {String(r.season)}
                      </td>
                    )}
                    {segment === "all" && (
                      <td className="px-3 py-1.5 capitalize">
                        {String(r.segment)}
                      </td>
                    )}
                    <td className="px-3 py-1.5 tabular-nums text-zinc-500">
                      {cell(r.rank)}
                    </td>
                    <td className="px-3 py-1.5 font-medium">
                      {cell(r.player_name)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                      {cell(r.team_name)}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                      {cell(r.division)}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                      {cell(r.tier)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.gp)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.g)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.a)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {cell(r.pts)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.pim)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.ppg)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && rows && rows.length > 0 && role === "goalie" && (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-800/50">
                  {year === "all" && (
                    <th className="px-3 py-2 font-semibold">Year</th>
                  )}
                  {segment === "all" && (
                    <th className="px-3 py-2 font-semibold">Segment</th>
                  )}
                  <th className="px-3 py-2 font-semibold">Goalie</th>
                  <th className="px-3 py-2 font-semibold">Tm</th>
                  <th className="px-3 py-2 font-semibold">Div</th>
                  <th className="px-3 py-2 font-semibold">Tier</th>
                  <th className="px-3 py-2 font-semibold text-right">GP</th>
                  <th className="px-3 py-2 font-semibold text-right">MIN</th>
                  <th className="px-3 py-2 font-semibold text-right">W</th>
                  <th className="px-3 py-2 font-semibold text-right">L</th>
                  <th className="px-3 py-2 font-semibold text-right">T</th>
                  <th className="px-3 py-2 font-semibold text-right">SO</th>
                  <th className="px-3 py-2 font-semibold text-right">GA</th>
                  <th className="px-3 py-2 font-semibold text-right">GAA</th>
                  <th className="px-3 py-2 font-semibold text-right">SV</th>
                  <th className="px-3 py-2 font-semibold text-right">SV%</th>
                </tr>
              </thead>
              <tbody>
                {(rows as Record<string, unknown>[]).map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-100 dark:border-zinc-800/80"
                  >
                    {year === "all" && (
                      <td className="px-3 py-1.5 tabular-nums">
                        {String(r.season)}
                      </td>
                    )}
                    {segment === "all" && (
                      <td className="px-3 py-1.5 capitalize">
                        {String(r.segment)}
                      </td>
                    )}
                    <td className="px-3 py-1.5 font-medium">
                      {cell(r.goalie_name)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                      {cell(r.team_name)}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                      {cell(r.division)}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                      {cell(r.tier)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.gp)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">
                      {cell(r.min_played)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.w)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.l)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.ties)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.shutouts)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.ga)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.gaa)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.sv)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(r.sv_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-zinc-500">
          Tip: bookmark or share URLs with query params (same as form fields).
        </p>
      </main>
    </div>
  );
}
