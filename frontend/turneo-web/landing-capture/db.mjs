// Acceso a la base aislada de las capturas de la landing.
//
// La API se levanta en ASPNETCORE_ENVIRONMENT=Testing pero con
// ConnectionStrings__DefaultConnection pisado por variable de entorno (ver
// playwright.landing.config.ts), así que host/puerto/usuario/contraseña salen
// de appsettings.Testing.json en runtime y solo cambia el nombre de la base.
// Nada de esto se escribe en disco ni se imprime: la contraseña viaja a psql
// por PGPASSWORD y a la API por el entorno del proceso.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEMO_DATABASE = "bd_turnos_landing_demo";

const TESTING_SETTINGS = path.resolve(__dirname, "../../../backend/Turneo.Api/appsettings.Testing.json");

/** @returns {Record<string, string>} pares clave/valor del connection string de Testing */
function readTestingConnection() {
  const raw = fs.readFileSync(TESTING_SETTINGS, "utf-8").replace(/^﻿/, "");
  const connectionString = JSON.parse(raw)?.ConnectionStrings?.DefaultConnection;
  if (typeof connectionString !== "string" || !connectionString) {
    throw new Error("appsettings.Testing.json no tiene ConnectionStrings:DefaultConnection");
  }
  /** @type {Record<string, string>} */
  const parts = {};
  for (const chunk of connectionString.split(";")) {
    const idx = chunk.indexOf("=");
    if (idx > 0) parts[chunk.slice(0, idx).trim().toLowerCase()] = chunk.slice(idx + 1).trim();
  }
  return parts;
}

/** Connection string de la base demo: mismo servidor que Testing, otra base. */
export function demoConnectionString() {
  const c = readTestingConnection();
  return [
    `Host=${c.host ?? "localhost"}`,
    `Port=${c.port ?? "5432"}`,
    `Database=${DEMO_DATABASE}`,
    `Username=${c.username ?? c["user id"] ?? "postgres"}`,
    `Password=${c.password ?? ""}`,
  ].join(";") + ";";
}

// psql no suele estar en el PATH en Windows: se busca también en PSQL_PATH y
// en la instalación estándar de PostgreSQL (la versión más nueva que haya).
function findPsql() {
  if (process.env.PSQL_PATH && fs.existsSync(process.env.PSQL_PATH)) return process.env.PSQL_PATH;

  const probe = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if (!probe.error && probe.status === 0) return "psql";

  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
    .filter(Boolean)
    .map((root) => path.join(String(root), "PostgreSQL"));
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const versions = fs
      .readdirSync(root)
      .filter((v) => fs.existsSync(path.join(root, v, "bin", "psql.exe")))
      .sort((a, b) => Number(b) - Number(a));
    if (versions.length > 0) return path.join(root, versions[0], "bin", "psql.exe");
  }
  throw new Error("No se encontró psql. Agregalo al PATH o definí PSQL_PATH con la ruta al ejecutable.");
}

/**
 * Ejecuta SQL con psql contra `database` (por stdin, sin pasar por el shell).
 * @param {string} sql
 * @param {string} [database]
 * @returns {string} salida de psql
 */
export function runSql(sql, database = DEMO_DATABASE) {
  const c = readTestingConnection();
  const result = spawnSync(
    findPsql(),
    ["-h", c.host ?? "localhost", "-p", c.port ?? "5432", "-U", c.username ?? "postgres", "-d", database,
      "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", "-f", "-"],
    {
      input: sql,
      encoding: "utf-8",
      env: { ...process.env, PGPASSWORD: c.password ?? "", PGCLIENTENCODING: "UTF8" },
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`psql terminó con código ${result.status}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

/** Borra la base demo si existe. La vuelve a crear la propia API (Database.Migrate() al arrancar). */
export function resetDemoDatabase() {
  // Cinturón y tiradores: esto jamás debe apuntar a bd_turnos_e2e ni a una base real.
  if (!DEMO_DATABASE.endsWith("_landing_demo")) {
    throw new Error(`Nombre de base inesperado: ${DEMO_DATABASE}`);
  }
  runSql(`DROP DATABASE IF EXISTS "${DEMO_DATABASE}" WITH (FORCE);`, "postgres");
}
