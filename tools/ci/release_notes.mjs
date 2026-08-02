#!/usr/bin/env node
// GOOBY IPA-Release-Notes (CI-37; Anschluss an W13C/RELEASE, Doc B §5.2).
//
// Generiert den KOMPLETTEN Release-Body für das GitHub-Release `ipa-v<version>`
// aus der Commit-Historie seit dem letzten `ipa-v*`-Tag — der release-Job in
// .github/workflows/gooby-godot.yml übergibt die Datei via `body_path` an
// softprops/action-gh-release. Damit entfällt das Hand-Gerüst („Was ist neu?"
// nach dem Lauf ausfüllen), das in der Praxis nie ausgefüllt wurde.
//
// Verwendung (Repo-Wurzel; im CI braucht der Checkout fetch-depth: 0, sonst
// fehlen Tags + Historie):
//   node tools/ci/release_notes.mjs --version 5.1.0 \
//     --output release-notes/RELEASE_NOTES.md
//
// Optionen:
//   --version <semver>   Pflicht, striktes MAJOR.MINOR.PATCH. Der zugehörige
//                        Tag ipa-v<version> wird bei der Vorgänger-Suche
//                        übersprungen (beim Tag-Push zeigt er auf HEAD).
//   --output <pfad>      Pflicht, Ziel-Markdown (Ordner wird angelegt).
//   --head <rev>         Ende der Historie (Default HEAD; für Tests).
//   --max-commits <n>    Listenlänge-Deckel (Default 40); Überhang wird als
//                        „… und N weitere Commits" zusammengefasst.
//   --repo-dir <pfad>    Git-Repo (Default CWD; für Tests).
//
// Vorgänger-Tag = höchster ipa-v*-Tag mit strikter Semver-Version KLEINER als
// --version, der von --head aus erreichbar ist (--merged; ein Tag auf einem
// fremden Branch zählt nicht). Kein Vorgänger (erster Release) → die letzten
// --max-commits Commits der gesamten Historie. Merge-Commits fliegen raus.
//
// Fail-closed wie tools/ci/bump_latest_native.mjs: ungültiges Semver,
// fehlende Argumente oder ein scheiternder git-Aufruf → Exit 1, es wird
// KEINE Datei geschrieben. Leere Range (Re-Tag desselben Commits) ist
// dagegen ok — die Notes sagen das dann explizit, der Release läuft durch.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

function fail(message) {
  console.error(`FEHLER: ${message}`);
  process.exit(1);
}

const SEMVER = /^\d+\.\d+\.\d+$/;

function semverParts(version) {
  return version.split(".").map((part) => Number.parseInt(part, 10));
}

// -1 / 0 / 1 wie ein Comparator (nur für strikte MAJOR.MINOR.PATCH-Strings).
function semverCompare(a, b) {
  const pa = semverParts(a);
  const pb = semverParts(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

const version = arg("version");
const outputPath = arg("output");
const head = arg("head", "HEAD");
const repoDir = arg("repo-dir", process.cwd());
const maxCommits = Number.parseInt(arg("max-commits", "40"), 10);

if (!SEMVER.test(version)) {
  fail(`--version '${version}' ist kein striktes Semver (MAJOR.MINOR.PATCH, z. B. 5.1.0).`);
}
if (!outputPath) fail("--output <pfad/zu/RELEASE_NOTES.md> fehlt.");
if (!Number.isInteger(maxCommits) || maxCommits < 1) {
  fail(`--max-commits '${arg("max-commits", "40")}' ist keine positive Ganzzahl.`);
}

function git(args) {
  try {
    return execFileSync("git", ["-C", repoDir, ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).trimEnd();
  } catch (error) {
    fail(`git ${args.join(" ")} scheiterte: ${error.stderr?.trim() || error.message}`);
  }
}

// --- Vorgänger-Tag bestimmen -------------------------------------------------
const mergedTags = git(["tag", "--list", "ipa-v*", "--merged", head]);
const previousTag = mergedTags
  .split("\n")
  .map((tag) => tag.trim())
  .filter((tag) => SEMVER.test(tag.replace(/^ipa-v/, "")))
  .filter((tag) => semverCompare(tag.replace(/^ipa-v/, ""), version) < 0)
  .sort((a, b) => semverCompare(b.replace(/^ipa-v/, ""), a.replace(/^ipa-v/, "")))[0];

const range = previousTag ? `${previousTag}..${head}` : head;

// --- Commits einsammeln ------------------------------------------------------
const totalCount = Number.parseInt(git(["rev-list", "--count", "--no-merges", range]), 10);
// %x1f (Unit Separator) statt Tab — Subjects dieses Repos enthalten alles Mögliche.
const logRaw = git([
  "log",
  "--no-merges",
  `--max-count=${maxCommits}`,
  "--pretty=format:%h%x1f%s",
  range,
]);

// Subjects sind hier oft Hunderte Zeichen lang — für die Liste an einer
// Wortgrenze kappen; der Kurz-Hash verlinkt in GitHub auf den vollen Text.
const SUBJECT_MAX = 160;
function truncateSubject(subject) {
  const clean = subject.replace(/[\u0000-\u001f]/g, " ").trim();
  if (clean.length <= SUBJECT_MAX) return clean;
  const cut = clean.slice(0, SUBJECT_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > SUBJECT_MAX - 30 ? lastSpace : SUBJECT_MAX).trimEnd()} …`;
}

const commits = logRaw
  .split("\n")
  .filter((line) => line.includes("\u001f"))
  .map((line) => {
    const [hash, subject] = line.split("\u001f");
    return { hash, subject: truncateSubject(subject ?? "") };
  });

// --- Markdown bauen ----------------------------------------------------------
// Kompletter Body (body_path ERSETZT body) — Installation/Hinweise entsprechen
// dem bisherigen Gerüst aus dem release-Job, „Was ist neu?" kommt aus git.
const serverUrl = process.env.GITHUB_SERVER_URL || "";
const repoSlug = process.env.GITHUB_REPOSITORY || "";
const repoUrl = serverUrl && repoSlug ? `${serverUrl}/${repoSlug}` : "";

const lines = [];
lines.push(`## GOOBY v${version} — unsignierte iOS-IPA (Sideload)`);
lines.push("");
lines.push("### Was ist neu?");
if (commits.length === 0) {
  lines.push(
    previousTag
      ? `_Keine neuen Commits seit \`${previousTag}\` — Re-Release desselben Standes._`
      : "_Keine Commits gefunden._"
  );
} else {
  lines.push(
    previousTag
      ? `_${totalCount} Commit${totalCount === 1 ? "" : "s"} seit \`${previousTag}\` (automatisch generiert):_`
      : `_Erster IPA-Release — die letzten ${commits.length} Commits (automatisch generiert):_`
  );
  lines.push("");
  for (const commit of commits) {
    lines.push(`- \`${commit.hash}\` ${commit.subject}`);
  }
  const overflow = totalCount - commits.length;
  if (overflow > 0) {
    const compareUrl =
      repoUrl && previousTag ? ` (${repoUrl}/compare/${previousTag}...ipa-v${version})` : "";
    lines.push(`- … und ${overflow} weitere Commits${compareUrl}`);
  } else if (repoUrl && previousTag) {
    lines.push("");
    lines.push(`Voller Vergleich: ${repoUrl}/compare/${previousTag}...ipa-v${version}`);
  }
}
lines.push("");
lines.push("### Installation");
lines.push(`- \`GOOBY-godot-unsigned-v${version}.ipa\` laden und`);
lines.push("  per AltStore/Sideloadly aufs Gerät bringen (Runbook:");
lines.push("  `docs/godot-rewrite/IOS-BUILD.md`).");
lines.push("- Die IPA ist **unsigniert** — kein App-Store-Download, keine Apple-Zertifikate.");
lines.push("");
lines.push("### Hinweise");
lines.push("- Daten-Updates (Cosmetics, Sticker, Balance, …) kommen weiterhin OHNE neue");
lines.push("  IPA über „Nach Updates suchen“ in den Einstellungen (`docs/UPDATES.md`).");
lines.push("- `latest_native` im Update-Manifest (rollender Release `updates` in diesem");
lines.push("  Repo) bumpt dieser Lauf automatisch auf diese Version — ältere Apps zeigen");
lines.push("  dann den „Neue App-Version nötig“-Hinweis. Existiert der `updates`-Release");
lines.push("  noch nicht, wird der Bump sauber übersprungen (s. Step-Notice).");
lines.push("");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join("\n"));
console.log(
  `Release-Notes v${version}: ${Math.min(totalCount, commits.length)}/${totalCount} Commits ` +
    `seit ${previousTag || "(Repo-Anfang — kein ipa-v*-Vorgänger)"} -> ${outputPath}`
);
