import {spawn} from "node:child_process";
import {appendFile, mkdir, readFile, writeFile} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";
import {z} from "zod";

const READ = /^(get|list|search|find|download|generate|compare)_/;

const usageDir = () =>
  join(
    process.env.XDG_CONFIG_HOME ||
      (process.platform === "win32"
        ? (process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
        : join(homedir(), ".config")),
    "atlassian-mcp",
  );

const usageFile = () => join(usageDir(), "usage.jsonl");

const isOff = () =>
  /^(off|false|0)$/i.test(process.env.ATLASSIAN_MCP_USAGE ?? "");

// shortcut: one file that only grows, about 70 bytes a call; rotate it if a
// user ever logs enough calls for its size to matter.
const record = async (pkg, tool, ok) => {
  if (isOff()) return;
  try {
    await mkdir(usageDir(), {recursive: true});
    const line = {ok, pkg, t: new Date().toISOString(), tool};
    await appendFile(usageFile(), `${JSON.stringify(line)}\n`);
  } catch (err) {
    // A log that cannot be written must never fail the tool call.
    console.error(`usage log not written: ${err.message}`);
  }
};

const isAllowed = (pkg, name) => {
  const allow = (process.env.ATLASSIAN_MCP_TOOLS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return (
    !allow.length ||
    [pkg, name, `${pkg}_${name}`].some((e) => allow.includes(e))
  );
};

/**
 * Logs the tool name and success of each call, never its arguments.
 * @param {any} server
 * @param {string} pkg
 */
export const withUsage = (server, pkg) => ({
  registerTool: (name, config, handler) => {
    if (!isAllowed(pkg, name)) return;
    return server.registerTool(name, config, async (...args) => {
      const result = await handler(...args);
      await record(pkg, name, !result?.isError);
      return result;
    });
  },
});

/** @param {{ok: boolean, pkg: string, t: string, tool: string}[]} entries */
export const importEntries = async (entries) => {
  const first = (await readEntries()).reduce(
    (min, e) => Math.min(min, Date.parse(e.t)),
    Number.POSITIVE_INFINITY,
  );
  const older = entries.filter((e) => Date.parse(e.t) < first);
  if (older.length) {
    await mkdir(usageDir(), {recursive: true});
    await appendFile(
      usageFile(),
      older
        .map(({ok, pkg, t, tool}) => `${JSON.stringify({ok, pkg, t, tool})}\n`)
        .join(""),
    );
  }
  return {added: older.length, file: usageFile()};
};

const readEntries = async () => {
  const text = await readFile(usageFile(), "utf8").catch((err) => {
    if (err.code === "ENOENT") return "";
    throw err;
  });
  return text.split("\n").flatMap((line) => {
    try {
      const entry = JSON.parse(line);
      return typeof entry?.tool === "string" && typeof entry.t === "string"
        ? [entry]
        : [];
    } catch {
      return [];
    }
  });
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const tally = (entries) => {
  const errors = entries.filter((e) => !e.ok).length;
  const writes = entries.filter((e) => !READ.test(e.tool));
  return {
    calls: entries.length,
    done: writes.filter((e) => e.ok).length,
    errors,
    reads: entries.length - writes.length,
    writes: writes.length,
  };
};

const groupBy = (entries, key) => {
  const groups = new Map();
  for (const e of entries)
    (groups.get(e[key]) ?? groups.set(e[key], []).get(e[key])).push(e);
  return [...groups].sort((a, b) => b[1].length - a[1].length);
};

const errorText = (n) => (n ? `, ${plural(n, "error")}` : "");

const textReport = (entries, days) => {
  const all = tally(entries);
  const lines = [
    `Last ${plural(days, "day")}: ${all.done} done, ${plural(all.calls, "call")} (${all.reads} read, ${all.writes} write)${errorText(all.errors)}.`,
    "Done counts the write calls that succeeded.",
  ];
  for (const [pkg, pkgEntries] of groupBy(entries, "pkg")) {
    const p = tally(pkgEntries);
    lines.push(
      "",
      `${pkg}: ${p.done} done, ${plural(p.calls, "call")}${errorText(p.errors)}`,
    );
    for (const [tool, toolEntries] of groupBy(pkgEntries, "tool")) {
      const t = tally(toolEntries);
      const kind = READ.test(tool) ? "read" : "write";
      const done = kind === "write" ? `${t.done} done, ` : "";
      lines.push(
        `  ${tool} (${kind}): ${done}${plural(t.calls, "call")}${errorText(t.errors)}`,
      );
    }
  }
  if (entries.length) {
    const used = [...new Set(entries.map((e) => e.tool))].sort();
    lines.push(
      "",
      `To expose only the tools used in this window: ATLASSIAN_MCP_TOOLS=${used.join(",")}`,
    );
  }
  return lines.join("\n");
};

// The whole log goes in so the range buttons need no server; "<" is escaped so it cannot close the script.
const boardHtml = (entries, generated, days) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlassian MCP usage</title>
<script>document.documentElement.classList.toggle("dark", localStorage.getItem("theme") ? localStorage.getItem("theme") === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);</script>
<style>
*{box-sizing:border-box}
:root{color-scheme:light}
body{font-family:Aptos,"Segoe UI",system-ui,sans-serif;font-size:16px;color:#101214;background:#fff;margin:0}
button{font:inherit;color:inherit;cursor:pointer;transition:background-color .15s,color .15s,border-color .15s}
:focus-visible{outline:2px solid #1868db;outline-offset:2px}
.top{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 16px;max-width:1280px;margin:0 auto;padding:24px 24px 16px;border-bottom:1px solid #dddee1}
h1{font-size:28px;font-weight:500;margin:0}
.top{position:sticky;top:0;z-index:3;background:#fff;box-shadow:0 0 0 100vmax #fff;clip-path:inset(0 -100vmax)}
.theme{display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid #dddee1;border-radius:100px;background:none}
.theme:hover{background:#eceef0}
.dark .theme:hover{background:#2c2d31}
.theme svg{width:18px;height:18px}
.theme .sun,.dark .theme .moon{display:none}
.dark .theme .sun{display:block}
.foot{max-width:1280px;margin:0 auto;padding:0 24px 24px;color:#505258;font-size:14px}
.wrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;max-width:1280px;margin:0 auto;padding:24px}
.rail{grid-column:2;grid-row:1;position:sticky;top:calc(var(--top,0px) + 16px);max-height:calc(100vh - var(--top,0px) - 32px);overflow-y:auto;align-self:start;background:#fff;border:1px solid #dddee1;border-radius:15px;padding:20px;display:grid;gap:20px}
main{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:24px;align-content:start}
.label{display:block;font-size:14px;font-weight:600;color:#505258;margin:0 0 8px}
nav{display:flex;flex-wrap:wrap;gap:4px;padding:4px;background:#fff;border:1px solid #dddee1;border-radius:100px}
nav button{flex:1 1 auto;padding:6px 10px;border:0;border-radius:100px;background:none;font-size:14px;white-space:nowrap}
nav button:hover{background:#eceef0}
nav button[aria-pressed=true]{background:#1868db;color:#fff}
nav button[aria-pressed=true]:hover{background:#1558bc}
.stats{display:grid;gap:12px}
.stat{background:#fff;border:1px solid #dddee1;border-radius:8px;padding:12px 16px}
.stat b{display:block;font-size:28px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}
.stat.hero b{font-size:40px}
.stat small{display:block;color:#505258;font-size:14px;margin-top:4px}
.stat.warn b,.warn{color:#b3261e}
td.warn{font-weight:600}
.split{display:flex;height:8px;border-radius:4px;overflow:hidden;background:#b8bcc4;margin-top:8px}
.split i{background:#3860be}
.sw{display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:4px;background:#b8bcc4}
.sw.w{background:#3860be}
ol{margin:0;padding:0;list-style:none;display:grid;gap:4px;font-size:14px}
ol li{display:flex;justify-content:space-between;gap:8px}
ol li span:last-child{font-variant-numeric:tabular-nums;font-weight:600}
.muted{color:#505258;font-size:14px;margin:0}
#card{width:100%;padding:10px 16px;border:0;border-radius:100px;background:#1868db;color:#fff;font-weight:600}
#card:hover{background:#1558bc}
#share{width:min(720px,calc(100vw - 32px));padding:16px;border:1px solid #dddee1;border-radius:15px}
#share::backdrop{background:rgb(16 18 20 / 0.5)}
#share canvas{display:block;width:100%;height:auto;border:1px solid #dddee1;border-radius:8px}
#share .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
#share .acts button{padding:8px 16px;border:1px solid #767676;border-radius:100px;background:#fff}
#share .acts button:hover{background:#f1f2f4;border-color:#292a2e}
#share .acts #copy{border-color:#1868db;color:#1868db;font-weight:600}
#share .acts #copy:hover{background:#e9f2fe}
#share .acts #download{border-color:#1868db;background:#1868db;color:#fff;font-weight:600}
#share .acts #download:hover{border-color:#1558bc;background:#1558bc}
.panel{border:1px solid #dddee1;border-radius:15px;padding:20px}
.head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;margin-bottom:12px}
h2{font-size:20px;font-weight:500;margin:0}
.head p{margin:0;color:#505258;font-size:14px}
.chartbox{position:relative}
svg{display:block;width:100%;height:220px;touch-action:pan-y}
svg:focus-visible{outline-offset:4px;border-radius:4px}
.grid{stroke:#dddee1}
.base{stroke:#696969}
.yl,.xl{fill:#505258;font-size:12px;font-family:inherit}
.yl{text-anchor:end}
rect.bar{fill:#3860be}
rect.bar.on{fill:#101214}
rect.hl{fill:#eceef0}
#tip{position:absolute;pointer-events:none;transform:translate(-50%,-100%);background:#101214;color:#fff;font-size:14px;padding:6px 10px;border-radius:4px;white-space:nowrap}
#tip b{font-variant-numeric:tabular-nums}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;padding:8px;border-bottom:1px solid #eceef0;white-space:nowrap}
thead th{position:sticky;top:var(--top,0px);z-index:2;padding:0;background:#fff;box-shadow:inset 0 -1px #dddee1;font-weight:600}
thead th button{width:100%;padding:8px;border:0;background:none;text-align:inherit;font-weight:600;color:#505258}
thead th button:hover{color:#101214;background:#f8f8f8}
thead th[aria-sort] button{color:#101214}
th[aria-sort=ascending] button::after{content:" ↑"}
th[aria-sort=descending] button::after{content:" ↓"}
.n{text-align:right}
tr.pkg th,tr.pkg td{font-weight:600;background:#f8f8f8;border-bottom-color:#dddee1}
td.na{color:#696969}
.fold{padding:0;border:0;background:none;font-weight:600;text-align:left}
tr.pkg{cursor:pointer}
tr.pkg:hover th,tr.pkg:hover td{background:#eceef0}
.dark tr.pkg:hover th,.dark tr.pkg:hover td{background:#2c2d31}
.kind{display:inline-block;padding:0 8px;border-radius:100px;font-size:12px;line-height:20px;background:#eceef0;color:#292a2e}
.kind.write{background:#e9eefa;color:#2c4c99}
.cc{display:flex;align-items:center;justify-content:flex-end;gap:8px;font-variant-numeric:tabular-nums}
.spark{display:flex;width:96px;height:8px;border-radius:4px;background:#eceef0;overflow:hidden}
.spark i{background:#3860be}
.spark i.e{background:#b3261e}
.cc span:last-child{min-width:44px}
td.n{font-variant-numeric:tabular-nums}
#empty{margin:0;padding:24px 0;color:#505258}
@media (max-width:900px){
.scroll{overflow-x:auto}
.wrap{grid-template-columns:minmax(0,1fr);padding:16px;gap:16px}
.rail{grid-column:auto;grid-row:auto;position:static;max-height:none}
.top{position:static;padding:16px}
.foot{padding:0 16px 16px}
thead th{top:0}
.rail{position:static;padding:16px;gap:16px}
.stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.stat{padding:8px 12px}
.stat b,.stat.hero b{font-size:24px}
.stat small{font-size:12px}
.panel{padding:16px}
th,td{padding:6px}
thead th{padding:0}
thead th button{padding:6px}
.spark{width:40px}
tbody tr>:first-child,thead th:first-child{position:sticky;left:0;background:#fff;z-index:1}
tbody tr.pkg>:first-child{background:#f8f8f8}
}
.dark{color-scheme:dark}
.dark body{color:#e6e7ea;background:#161718}
.dark .top{background:#161718;box-shadow:0 0 0 100vmax #161718}
.dark :focus-visible{outline-color:#6b9cf0}
.dark .top,.dark .rail,.dark nav,.dark .stat,.dark .panel,.dark #share,.dark #share canvas{border-color:#3a3b3f}
.dark .rail,.dark nav,.dark .stat,.dark #share{background:#1f2023;color:#e6e7ea}
.dark .foot,.dark .label,.dark .stat small,.dark .muted,.dark .head p,.dark #empty,.dark thead th button{color:#a9abb2}
.dark nav button:hover,.dark #share .acts button:hover{background:#2c2d31}
.dark .stat.warn b,.dark .warn{color:#f28b82}
.dark .split,.dark .sw{background:#5b5e66}
.dark .split i,.dark .sw.w,.dark .spark i{background:#6b93f0}
.dark rect.bar{fill:#6b93f0}
.dark rect.bar.on{fill:#e6e7ea}
.dark rect.hl{fill:#2c2d31}
.dark .grid{stroke:#3a3b3f}
.dark .base{stroke:#8b8d94}
.dark .yl,.dark .xl{fill:#a9abb2}
.dark #tip{background:#e6e7ea;color:#161718}
.dark th,.dark td{border-bottom-color:#2c2d31}
.dark thead th{background:#161718;box-shadow:inset 0 -1px #3a3b3f}
.dark thead th button:hover{color:#e6e7ea;background:#1f2023}
.dark thead th[aria-sort] button{color:#e6e7ea}
.dark tr.pkg th,.dark tr.pkg td{background:#1f2023;border-bottom-color:#3a3b3f}
.dark td.na{color:#8b8d94}
.dark .kind{background:#2c2d31;color:#c9cbd1}
.dark .kind.write{background:#1c2b4d;color:#a8c1f5}
.dark .spark{background:#2c2d31}
.dark #share .acts button{background:#1f2023;border-color:#8b8d94}
.dark #share .acts button:hover{border-color:#e6e7ea}
.dark #share .acts #copy{border-color:#6b9cf0;color:#6b9cf0}
.dark #share .acts #copy:hover{background:#1c2b4d}
.dark nav button[aria-pressed=true]:hover{background:#1558bc}
.dark .theme{border-color:#3a3b3f}
.dark .spark i.e{background:#f28b82}
@media (max-width:900px){
.dark tbody tr>:first-child,.dark thead th:first-child{background:#161718}
.dark tbody tr.pkg>:first-child{background:#1f2023}
}
</style>
</head>
<body>
<header class="top">
<h1>Atlassian MCP usage</h1>
<button id="theme" class="theme" aria-label="Dark mode" title="Dark mode"><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg></button>
</header>
<div class="wrap">
<aside class="rail">
<div><span class="label" aria-hidden="true">Range</span>
<nav aria-label="Range">${[...new Set([7, 30, 90, days])]
  .sort((x, y) => x - y)
  .map((d) => `<button data-days="${d}">${d} days</button>`)
  .join("")}<button data-days="0">All</button></nav></div>
<section class="stats" aria-live="polite" aria-label="Totals">
<div class="stat hero"><span class="label">Done</span><b id="done"></b><small>write calls that succeeded</small></div>
<div class="stat"><span class="label">Calls</span><b id="calls"></b><div class="split" aria-hidden="true"><i id="splitW"></i></div><small><span class="sw" aria-hidden="true"></span><span id="reads"></span> read, <span class="sw w" aria-hidden="true"></span><span id="writes"></span> write</small></div>
<div class="stat" id="errBox"><span class="label">Errors</span><b id="errors"></b><small id="rate"></small></div>
</section>
<div><span class="label">Most done</span><ol id="outcomes"></ol><p class="muted" id="noOutcomes" hidden>Nothing written in this range.</p></div>
<button id="card" aria-haspopup="dialog">Share card</button>
</aside>
<dialog id="share" aria-label="Share card preview">
<canvas id="sharecard" role="img" aria-label="Share card with the counts for this range"></canvas>
<div class="acts"><button id="close">Close</button><button id="copy" hidden>Copy image</button><button id="download">Download PNG</button></div>
</dialog>
<main>
<section class="panel">
<div class="head"><h2>Done per day</h2><p id="peak"></p></div>
<div class="chartbox"><svg id="chart" role="img" tabindex="0" aria-describedby="chartHelp"></svg><div id="tip" aria-hidden="true" hidden></div></div>
<p class="muted" id="chartHelp" hidden>Use the left and right arrow keys to read each day.</p>
</section>
<section class="panel">
<div class="head"><h2>By tool</h2><p>Click a column header to sort. Each bar shows calls, with errors in red.</p></div>
<div class="scroll"><table><thead><tr><th scope="col" data-key="tool"><button>Tool</button></th><th scope="col" data-key="kind"><button>Kind</button></th><th scope="col" class="n" data-key="done"><button>Done</button></th><th scope="col" class="n" data-key="calls"><button>Calls</button></th><th scope="col" class="n" data-key="errors"><button>Errors</button></th><th scope="col" class="n" data-key="rate"><button>Error rate</button></th></tr></thead><tbody id="rows"></tbody></table></div>
<p id="empty" hidden>No tool calls in this range. Pick a longer range, or use a tool and open the board again.</p>
</section>
</main>
</div>
<footer class="foot">Updated <time id="generated" datetime="${generated}">${generated}</time>. Every number is counted from your local usage log.</footer>
<script>
const ENTRIES = ${JSON.stringify(entries).replace(/</g, "\\u003c")};
const READ = new RegExp(${JSON.stringify(READ.source)});
const DONE_AS = {add_attachment: "attachments added", add_comment: "comments added", create_page: "pages created", create_ticket: "tickets created", link_issues: "issues linked", log_work: "worklogs logged", patch_page: "page edits", transition_ticket: "tickets moved", update_comment: "comment edits", update_page: "page updates", update_ticket: "ticket updates", update_worklog: "worklog edits"};
const NS = "http://www.w3.org/2000/svg";
const themeBtn = document.getElementById("theme");
const syncTheme = () => themeBtn.setAttribute("aria-pressed", document.documentElement.classList.contains("dark"));
syncTheme();
themeBtn.addEventListener("click", () => {
  localStorage.setItem("theme", document.documentElement.classList.toggle("dark") ? "dark" : "light");
  syncTheme();
});
const topBar = document.querySelector(".top");
new ResizeObserver(() => document.documentElement.style.setProperty("--top", topBar.offsetHeight + "px")).observe(topBar);
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");
const pct = (n, of) => (of ? Math.round((n / of) * 100) : 0) + "%";
const dayOf = (t) => new Date(t).toLocaleDateString("en-CA");
const dayLabel = (day, year) => new Date(day + "T00:00").toLocaleDateString("en-GB", year ? {day: "numeric", month: "short", year: "numeric"} : {day: "numeric", month: "short"});
const startOf = (t) => new Date(t).setHours(0, 0, 0, 0);
const daysAgo = (n) => {
  const d = new Date(startOf(Date.now()));
  d.setDate(d.getDate() - n + 1);
  return d.getTime();
};
const doneAs = (tool) => DONE_AS[tool] ?? tool.replaceAll("_", " ");
const isDone = (e) => e.ok && !READ.test(e.tool);
const tally = (rows) => ({calls: rows.length, done: rows.filter(isDone).length, errors: rows.filter((e) => !e.ok).length});
const svgEl = (tag, attrs, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text !== undefined) n.textContent = text;
  return n;
};
let range = ${days};
let shown = {};
let chart = {active: -1, days: [], perDay: new Map()};
let sort = {dir: -1, key: "calls"};

$("generated").textContent = new Date($("generated").dateTime).toLocaleString("en-GB", {dateStyle: "medium", timeStyle: "short"});

const niceStep = (max) => {
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return Math.max(1, [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw));
};

const drawChart = () => {
  const svg = $("chart");
  const {days, perDay, active} = chart;
  const W = svg.clientWidth || 640;
  const H = 220;
  const pad = {b: 28, l: 44, r: 8, t: 12};
  const max = Math.max(1, ...days.map((d) => perDay.get(d)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ih = H - pad.t - pad.b;
  const slot = (W - pad.l - pad.r) / days.length;
  const bw = Math.max(1, Math.min(28, slot * 0.7));
  const y = (v) => pad.t + ih - (v / top) * ih;
  const nodes = [];
  if (active >= 0) nodes.push(svgEl("rect", {class: "hl", height: ih, width: slot, x: pad.l + active * slot, y: pad.t}));
  for (let v = step; v <= top; v += step) nodes.push(svgEl("line", {class: "grid", x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v)}));
  for (let v = 0; v <= top; v += step) nodes.push(svgEl("text", {class: "yl", x: pad.l - 8, y: y(v) + 4}, fmt(v)));
  days.forEach((d, i) => {
    const v = perDay.get(d);
    if (v) nodes.push(svgEl("rect", {class: i === active ? "bar on" : "bar", height: y(0) - y(v), rx: Math.min(2, bw / 2), width: bw, x: pad.l + i * slot + (slot - bw) / 2, y: y(v)}));
  });
  nodes.push(svgEl("line", {class: "base", x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0)}));
  const ticks = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  for (const i of ticks) {
    const anchor = ticks.length > 1 && i === 0 ? "start" : i === days.length - 1 && i ? "end" : "middle";
    const x = anchor === "start" ? pad.l : anchor === "end" ? W - pad.r : pad.l + (i + 0.5) * slot;
    nodes.push(svgEl("text", {class: "xl", "text-anchor": anchor, x, y: H - 8}, dayLabel(days[i])));
  }
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.replaceChildren(...nodes);
  const tip = $("tip");
  tip.hidden = active < 0;
  if (active >= 0) {
    const v = perDay.get(days[active]);
    const b = document.createElement("b");
    b.textContent = fmt(v) + " done";
    tip.replaceChildren(dayLabel(days[active], true) + ": ", b);
    const x = pad.l + (active + 0.5) * slot;
    tip.style.left = Math.min(W - tip.offsetWidth / 2, Math.max(tip.offsetWidth / 2, x)) + "px";
    tip.style.top = Math.max(tip.offsetHeight, y(v) - 6) + "px";
  }
};
const setActive = (i) => {
  chart.active = i < 0 ? -1 : Math.min(chart.days.length - 1, Math.max(0, i));
  drawChart();
};

const KEYS = {calls: (r) => r.calls, done: (r) => (r.read ? -1 : r.done), errors: (r) => r.errors, kind: (r) => r.kind, rate: (r) => (r.calls ? r.errors / r.calls : 0), tool: (r) => r.name};
const cmp = (a, b) => {
  const x = KEYS[sort.key](a);
  const z = KEYS[sort.key](b);
  return (typeof x === "string" ? x.localeCompare(z) : x - z) * sort.dir || b.calls - a.calls || a.name.localeCompare(b.name);
};
const cell = (text, cls, tag) => {
  const td = document.createElement(tag ?? "td");
  if (cls) td.className = cls;
  if (text !== undefined) td.textContent = text;
  return td;
};
const rateCell = (g) => cell(pct(g.errors, g.calls), g.calls && g.errors / g.calls >= 0.1 ? "n warn" : "n");
const callsCell = (g, maxCalls) => {
  const td = cell(undefined, "n");
  const wrap = document.createElement("div");
  wrap.className = "cc";
  if (maxCalls) {
    const spark = document.createElement("span");
    spark.className = "spark";
    spark.setAttribute("aria-hidden", "true");
    const ok = document.createElement("i");
    ok.style.width = ((g.calls - g.errors) / maxCalls) * 100 + "%";
    const err = document.createElement("i");
    err.className = "e";
    err.style.width = (g.errors / maxCalls) * 100 + "%";
    spark.append(ok, err);
    wrap.append(spark);
  }
  const num = document.createElement("span");
  num.textContent = fmt(g.calls);
  wrap.append(num);
  td.append(wrap);
  return td;
};
const kindCell = (kind) => {
  const td = cell();
  const s = document.createElement("span");
  s.className = "kind " + kind;
  s.textContent = kind;
  td.append(s);
  return td;
};

const collapsed = new Set();
const render = () => {
  const since = range ? daysAgo(range) : 0;
  const list = ENTRIES.filter((e) => Date.parse(e.t) >= since);
  const all = tally(list);
  const reads = list.filter((e) => READ.test(e.tool)).length;
  const doneByTool = new Map();
  for (const e of list.filter(isDone)) doneByTool.set(e.tool, (doneByTool.get(e.tool) ?? 0) + 1);
  const top = [...doneByTool].sort((x, y) => y[1] - x[1]);

  const first = range ? since : startOf(list.reduce((m, e) => Math.min(m, Date.parse(e.t)), Date.now()));
  const days = [];
  for (const d = new Date(first); d.getTime() <= Date.now(); d.setDate(d.getDate() + 1)) days.push(dayOf(d));
  const perDay = new Map(days.map((d) => [d, 0]));
  for (const e of list.filter(isDone)) perDay.set(dayOf(e.t), (perDay.get(dayOf(e.t)) ?? 0) + 1);
  const peak = days.reduce((p, d) => (perDay.get(d) > perDay.get(p) ? d : p), days[0]);

  shown = {...all, from: dayLabel(days[0], true), to: dayLabel(days.at(-1), true), top};
  $("done").textContent = fmt(all.done);
  $("calls").textContent = fmt(all.calls);
  $("reads").textContent = fmt(reads);
  $("writes").textContent = fmt(all.calls - reads);
  $("splitW").style.width = all.calls ? ((all.calls - reads) / all.calls) * 100 + "%" : "0";
  $("errors").textContent = fmt(all.errors);
  $("errBox").classList.toggle("warn", all.calls > 0 && all.errors / all.calls >= 0.1);
  $("rate").textContent = all.calls ? pct(all.errors, all.calls) + " error rate, " + pct(all.calls - all.errors, all.calls) + " succeeded" : "No calls in this range";
  $("outcomes").replaceChildren(...top.slice(0, 5).map(([tool, n]) => {
    const li = document.createElement("li");
    const a = document.createElement("span");
    a.textContent = doneAs(tool);
    const b = document.createElement("span");
    b.textContent = fmt(n);
    li.append(a, b);
    return li;
  }));
  $("noOutcomes").hidden = top.length > 0;
  for (const b of document.querySelectorAll("nav[aria-label=Range] button")) {
    b.setAttribute("aria-pressed", String(Number(b.dataset.days) === range));
  }

  const total = days.reduce((s, d) => s + perDay.get(d), 0);
  $("peak").textContent = total ? fmt(total) + " done over " + fmt(days.length) + (days.length === 1 ? " day" : " days") + ", most " + fmt(perDay.get(peak)) + " on " + dayLabel(peak) : "Nothing done in this range";
  $("chart").setAttribute("aria-label", "Done per day from " + shown.from + " to " + shown.to + ". " + (total ? "Most: " + fmt(perDay.get(peak)) + " on " + dayLabel(peak, true) + "." : "None."));
  chart = {active: -1, days, perDay};
  drawChart();

  const byPkg = new Map();
  for (const e of list) {
    const tools = byPkg.get(e.pkg) ?? byPkg.set(e.pkg, new Map()).get(e.pkg);
    (tools.get(e.tool) ?? tools.set(e.tool, []).get(e.tool)).push(e);
  }
  const groups = [...byPkg].map(([pkg, tools]) => ({
    ...tally([...tools.values()].flat()),
    kind: "",
    name: pkg,
    tools: [...tools].map(([tool, calls]) => ({...tally(calls), kind: READ.test(tool) ? "read" : "write", name: tool, read: READ.test(tool)})),
  }));
  const maxCalls = Math.max(0, ...groups.flatMap((g) => g.tools.map((t) => t.calls)));
  const rows = [];
  for (const p of groups.sort(cmp)) {
    const tr = document.createElement("tr");
    tr.className = "pkg";
    tr.append(cell(p.name, "", "th"), cell(), cell(fmt(p.done), "n"), callsCell(p, 0), cell(fmt(p.errors), "n"), rateCell(p));
    tr.firstChild.scope = "row";
    const fold = document.createElement("button");
    fold.className = "fold";
    fold.textContent = p.name;
    fold.setAttribute("aria-expanded", String(!collapsed.has(p.name)));
    tr.addEventListener("click", () => {
      if (collapsed.has(p.name)) collapsed.delete(p.name);
      else collapsed.add(p.name);
      render();
    });
    tr.firstChild.replaceChildren(fold);
    rows.push(tr);
    for (const t of p.tools.sort(cmp)) {
      const r = document.createElement("tr");
      r.append(cell(t.name), kindCell(t.kind), t.read ? cell("n/a", "n na") : cell(fmt(t.done), "n"), callsCell(t, maxCalls), cell(fmt(t.errors), "n"), rateCell(t));
      r.hidden = collapsed.has(p.name);
      rows.push(r);
    }
  }
  $("rows").replaceChildren(...rows);
  $("empty").hidden = list.length > 0;
  document.querySelector("table").hidden = list.length === 0;
  for (const th of document.querySelectorAll("thead th")) {
    if (th.dataset.key === sort.key) th.setAttribute("aria-sort", sort.dir > 0 ? "ascending" : "descending");
    else th.removeAttribute("aria-sort");
  }
};

const FONT = "px Aptos, Segoe UI, sans-serif";
const fit = (g, text, weight, size, width) => {
  g.font = weight + size + FONT;
  while (g.measureText(text).width > width && size > 12) {
    size -= 2;
    g.font = weight + size + FONT;
  }
};
const drawCard = (c) => {
  c.width = 1200;
  c.height = 630;
  const g = c.getContext("2d");
  const k = document.documentElement.classList.contains("dark")
    ? {bg: "#161718", panel: "#1f2023", ink: "#e6e7ea", muted: "#a9abb2", track: "#2c2d31", bar: "#6b93f0"}
    : {bg: "#fff", panel: "#f8f8f8", ink: "#101214", muted: "#505258", track: "#eceef0", bar: "#3860be"};
  const text = (s, weight, size, width, x, y, color) => {
    g.fillStyle = color ?? k.ink;
    fit(g, s, weight, size, width);
    g.fillText(s, x, y);
  };
  g.fillStyle = k.bg;
  g.fillRect(0, 0, 1200, 630);
  g.fillStyle = k.panel;
  g.beginPath();
  g.roundRect(40, 40, 500, 550, 24);
  g.fill();
  text("Atlassian MCP usage", "bold ", 36, 420, 80, 112);
  text(shown.from + " to " + shown.to, "", 24, 420, 80, 152, k.muted);
  text(fmt(shown.done), "bold ", 160, 420, 80, 360);
  text("actions done", "", 32, 420, 80, 412, k.muted);
  text(shown.calls ? fmt(shown.calls) + " tool calls, " + pct(shown.calls - shown.errors, shown.calls) + " succeeded" : "No tool calls in this range", "", 24, 420, 80, 540, k.muted);
  text("Most done", "bold ", 24, 540, 600, 112, k.muted);
  const list = shown.top.slice(0, 5);
  const most = list.length ? list[0][1] : 1;
  list.forEach(([tool, n], i) => {
    const y = 180 + i * 84;
    text(doneAs(tool), "", 28, 400, 600, y);
    g.textAlign = "right";
    text(fmt(n), "bold ", 28, 140, 1140, y);
    g.textAlign = "left";
    g.fillStyle = k.track;
    g.beginPath();
    g.roundRect(600, y + 16, 540, 12, 6);
    g.fill();
    g.fillStyle = k.bar;
    g.beginPath();
    g.roundRect(600, y + 16, Math.max(12, (n / most) * 540), 12, 6);
    g.fill();
  });
  if (!list.length) text("Nothing written in this range.", "", 28, 540, 600, 180, k.muted);
  text("Every number is counted from the local usage log", "", 20, 540, 600, 580, k.muted);
};
const saveCard = () => {
  $("sharecard").toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "atlassian-mcp-usage.png";
    a.click();
  });
};

for (const b of document.querySelectorAll("nav[aria-label=Range] button")) {
  b.addEventListener("click", () => {
    range = Number(b.dataset.days);
    render();
  });
}
for (const th of document.querySelectorAll("thead th")) {
  th.querySelector("button").addEventListener("click", () => {
    const key = th.dataset.key;
    sort = key === sort.key ? {dir: -sort.dir, key} : {dir: key === "tool" || key === "kind" ? 1 : -1, key};
    render();
  });
}
const svg = $("chart");
const pick = (e) => {
  const r = svg.getBoundingClientRect();
  const i = Math.floor(((e.clientX - r.left - 44) / (r.width - 52)) * chart.days.length);
  if (i !== chart.active && i >= 0 && i < chart.days.length) setActive(i);
};
svg.addEventListener("pointermove", pick);
svg.addEventListener("pointerdown", pick);
svg.addEventListener("pointerleave", () => {
  if (document.activeElement !== svg) setActive(-1);
});
svg.addEventListener("focus", () => {
  $("chartHelp").hidden = !svg.matches(":focus-visible");
  if (chart.active < 0) setActive(chart.days.length - 1);
});
svg.addEventListener("blur", () => {
  $("chartHelp").hidden = true;
  setActive(-1);
});
svg.addEventListener("keydown", (e) => {
  const to = {ArrowLeft: chart.active - 1, ArrowRight: chart.active + 1, End: chart.days.length - 1, Home: 0}[e.key];
  if (to === undefined) return;
  e.preventDefault();
  setActive(to);
});
new ResizeObserver(() => drawChart()).observe(svg);
$("card").addEventListener("click", () => {
  drawCard($("sharecard"));
  $("share").showModal();
});
$("download").addEventListener("click", saveCard);
$("close").addEventListener("click", () => $("share").close());
$("copy").hidden = !navigator.clipboard?.write;
$("copy").addEventListener("click", () => {
  $("sharecard").toBlob(async (blob) => {
    const b = $("copy");
    try {
      await navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);
      b.textContent = "Copied";
    } catch {
      b.textContent = "Copy failed, try Download PNG";
    }
    setTimeout(() => {
      b.textContent = "Copy image";
    }, 2000);
  });
});
render();
</script>
</body>
</html>
`;

const openInBrowser = (file) => {
  // rundll32, not cmd start, so cmd never parses & or ^ in the path.
  const [cmd, args] =
    process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", file]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [file]];
  spawn(cmd, args, {detached: true, stdio: "ignore"})
    .on("error", () => {})
    .unref();
};

/**
 * @param {any} server
 * @param {(file: string) => void} [open]
 */
export const registerUsageReport = (server, open = openInBrowser) => {
  server.registerTool(
    "usage_report",
    {
      description:
        "Show what the Atlassian MCP tools did for the user from the local usage log: done (write calls that succeeded), calls split into read and write, and errors, per package and tool. format html also writes a board page with charts and a share card and opens it in the browser.",
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("How many days back to count (default 30)"),
        format: z
          .enum(["text", "html"])
          .optional()
          .describe("html: also write and open the board page"),
      }),
    },
    async ({days = 30, format = "text"}) => {
      try {
        const all = await readEntries();
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        since.setDate(since.getDate() - days + 1);
        let text = textReport(
          all.filter((e) => Date.parse(e.t) >= since.getTime()),
          days,
        );
        if (format === "html") {
          const board = join(usageDir(), "board.html");
          await mkdir(usageDir(), {recursive: true});
          await writeFile(
            board,
            boardHtml(all, new Date().toISOString(), days),
          );
          open(board);
          text += `\n\nBoard: ${board}`;
        }
        if (isOff()) {
          text += "\n\nLogging is off (ATLASSIAN_MCP_USAGE=off).";
        }
        return {content: [{text, type: "text"}]};
      } catch (err) {
        return {content: [{text: err.message, type: "text"}], isError: true};
      }
    },
  );
};
