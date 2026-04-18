/**
 * Loads CSV exports from ../NBHL STATS into Supabase.
 * Requires SUPABASE_SERVICE_ROLE_KEY (and URL) in .env.local — never expose the service key in the browser.
 *
 * Usage: npm run import:nbhl
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });
dotenv.config({ path: path.join(projectRoot, ".env") });

const STATS_DIR = path.resolve(__dirname, "../../NBHL STATS");

const FILE_RE =
  /^NBHL Historic Stats - (\d{4}) (Regular|Playoffs|Mylec Cup) (PLAYER|GOALIE)\.csv$/i;

type Segment = "regular" | "playoffs" | "mylec";

function normHeader(h: string): string {
  return h.trim().toLowerCase();
}

function normRow(
  row: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normHeader(k)] = (v ?? "").trim();
  }
  return out;
}

function parseIntOrNull(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseNumOrNull(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function mapSegment(s: string): Segment {
  const x = s.toLowerCase();
  if (x === "regular") return "regular";
  if (x === "playoffs") return "playoffs";
  if (x === "mylec cup") return "mylec";
  throw new Error(`Unknown segment: ${s}`);
}

function readCsv(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  return rows.map(normRow);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const looksPlaceholder =
    /YOUR_PROJECT_REF|your_project_ref|your_anon_key|your_service_role_key/i;
  if (looksPlaceholder.test(url) || looksPlaceholder.test(serviceKey)) {
    console.error(
      ".env.local still has example placeholders. Paste your real Project URL and service_role key from Supabase → Project Settings → API.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(STATS_DIR)) {
    console.error("Stats folder not found:", STATS_DIR);
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const { error: truncSkate } = await supabase
    .from("skating_stats")
    .delete()
    .gte("season", 1990);
  if (truncSkate) throw truncSkate;

  const { error: truncGoalie } = await supabase
    .from("goalie_stats")
    .delete()
    .gte("season", 1990);
  if (truncGoalie) throw truncGoalie;

  const skatingBatch: Record<string, unknown>[] = [];
  const goalieBatch: Record<string, unknown>[] = [];

  const years = fs.readdirSync(STATS_DIR).filter((d) => /^\d{4}$/.test(d));

  for (const yearDir of years.sort()) {
    const dir = path.join(STATS_DIR, yearDir);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".csv"));

    for (const file of files) {
      const m = file.match(FILE_RE);
      if (!m) {
        console.warn("Skip (name pattern):", file);
        continue;
      }

      const season = Number.parseInt(m[1], 10);
      const segment = mapSegment(m[2]);
      const kind = m[3].toUpperCase();
      const filePath = path.join(dir, file);
      const rows = readCsv(filePath);

      if (kind === "PLAYER") {
        for (const r of rows) {
          const name = r.player ?? "";
          if (!name) continue;
          skatingBatch.push({
            season,
            segment,
            rank: parseIntOrNull(r.rank),
            player_name: name,
            jersey: r.jersey || null,
            team_name: r.team || "Unknown",
            division: r.division || null,
            tier: r.tier || null,
            gp: parseIntOrNull(r.gp),
            g: parseIntOrNull(r.g),
            a: parseIntOrNull(r.a),
            pts: parseIntOrNull(r.pts),
            pim: parseNumOrNull(r.pim),
            ppg: parseNumOrNull(r.ppg),
          });
        }
      } else {
        for (const r of rows) {
          const name = r.goalie ?? "";
          if (!name) continue;
          const svPct =
            parseNumOrNull(r["sv%"]) ??
            parseNumOrNull(r.sv_pct) ??
            parseNumOrNull(r["sv %"]);
          goalieBatch.push({
            season,
            segment,
            goalie_name: name,
            jersey: r.jersey || null,
            team_name: r.team || "Unknown",
            division: r.division || null,
            tier: r.tier || null,
            gp: parseIntOrNull(r.gp),
            min_played: r.min || null,
            w: parseIntOrNull(r.w),
            l: parseIntOrNull(r.l),
            ties: parseIntOrNull(r.t),
            shutouts: parseIntOrNull(r.so),
            ga: parseIntOrNull(r.ga),
            gaa: parseNumOrNull(r.gaa),
            sv: parseIntOrNull(r.sv),
            sv_pct: svPct,
          });
        }
      }
    }
  }

  const chunk = 500;
  for (let i = 0; i < skatingBatch.length; i += chunk) {
    const slice = skatingBatch.slice(i, i + chunk);
    const { error } = await supabase.from("skating_stats").insert(slice);
    if (error) throw error;
    console.log(`Skating ${Math.min(i + chunk, skatingBatch.length)}/${skatingBatch.length}`);
  }

  for (let i = 0; i < goalieBatch.length; i += chunk) {
    const slice = goalieBatch.slice(i, i + chunk);
    const { error } = await supabase.from("goalie_stats").insert(slice);
    if (error) throw error;
    console.log(`Goalie ${Math.min(i + chunk, goalieBatch.length)}/${goalieBatch.length}`);
  }

  console.log(
    `Done. Inserted ${skatingBatch.length} skater rows, ${goalieBatch.length} goalie rows.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
