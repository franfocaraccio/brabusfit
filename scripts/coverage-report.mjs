// Junta los coverage-summary.json de Vitest y arma:
//  - una tabla para el resumen del job de CI ($GITHUB_STEP_SUMMARY), y
//  - coverage.json para el badge de shields.io (endpoint).
//
// Uso: node scripts/coverage-report.mjs <dir-con-los-summaries> <salida.json>
// Cada summary va en <dir>/<nombre>/coverage-summary.json.

import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const [dir = "coverage-artifacts", out = "coverage.json"] =
  process.argv.slice(2);

// Qué suite mide cada paquete (la capa de datos se mide con los tests de base).
const SUITES = [
  ["shared", "packages/shared (unit)"],
  ["supabase-db", "packages/supabase (RLS + integration)"],
  ["web", "apps/web (components)"],
];

const rows = [];
let covered = 0;
let total = 0;
for (const [name, label] of SUITES) {
  const file = join(dir, name, "coverage-summary.json");
  if (!existsSync(file)) {
    console.warn(`Falta ${file}`);
    continue;
  }
  const { lines } = JSON.parse(readFileSync(file, "utf8")).total;
  covered += lines.covered;
  total += lines.total;
  rows.push(
    `| ${label} | ${lines.pct.toFixed(1)}% | ${lines.covered}/${lines.total} |`,
  );
}
if (total === 0) {
  console.error("No hay datos de coverage.");
  process.exit(1);
}

const pct = (covered / total) * 100;
const color =
  pct >= 80
    ? "brightgreen"
    : pct >= 60
      ? "green"
      : pct >= 40
        ? "yellow"
        : "orange";
writeFileSync(
  out,
  JSON.stringify({
    schemaVersion: 1,
    label: "coverage",
    message: `${Math.round(pct)}%`,
    color,
  }) + "\n",
);

const table = [
  "### Coverage (lines)",
  "",
  "| Suite | Lines | Covered |",
  "|---|---|---|",
  ...rows,
  `| **Total** | **${pct.toFixed(1)}%** | ${covered}/${total} |`,
  "",
].join("\n");
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
