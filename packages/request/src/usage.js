import {spawn} from "node:child_process";
import {appendFile, mkdir, readFile, writeFile} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";
import {z} from "zod";

const DAY_MS = 86_400_000;
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
 * A server that registers only the tools ATLASSIAN_MCP_TOOLS allows, and whose
 * tools log each call (tool name and success, never the arguments) to the
 * local usage log.
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

/**
 * Appends past calls older than the log's first entry, so importing the same
 * history again adds nothing.
 * @param {{ok: boolean, pkg: string, t: string, tool: string}[]} entries
 */
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

/** Calls, errors and done (successful writes) of a list of entries. */
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
  return lines.join("\n");
};

// The whole log goes into the page, so its range buttons need no server.
// "<" is escaped so no logged text can close the script tag.
const boardHtml = (entries, generated, days) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Atlassian MCP usage</title>
<style>
body{font-family:Aptos,"Segoe UI",system-ui,sans-serif;color:#000;background:#fff;max-width:960px;margin:32px auto;padding:0 16px}
h1{margin:0}h2{font-size:18px;margin:32px 0 8px}
.sub{color:#444;margin:4px 0 16px}
nav button,#card{font:inherit;padding:6px 14px;margin-right:6px;border:1px solid #999;border-radius:6px;background:#fff;cursor:pointer}
nav button[aria-pressed=true]{background:#1f4e79;color:#fff;border-color:#1f4e79}
.stats{display:flex;gap:16px;margin-top:16px}
.stats div{flex:1;border:1px solid #ddd;border-radius:8px;padding:12px 16px}
.stats b{display:block;font-size:32px}
svg{width:100%;height:180px;border-bottom:1px solid #999}
rect{fill:#1f4e79}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
td.n,th.n{text-align:right}
</style>
</head>
<body>
<h1>Atlassian MCP usage</h1>
<p class="sub">Counted from the local usage log on ${generated}. Done counts the write calls that succeeded. Nothing here is estimated.</p>
<nav aria-label="Range"><button data-days="7">7 days</button><button data-days="30">30 days</button><button data-days="90">90 days</button><button data-days="0">All</button></nav>
<section class="stats">
<div><b id="done"></b>done</div>
<div><b id="calls"></b>calls (<span id="reads"></span> read, <span id="writes"></span> write)</div>
<div><b id="errors"></b>errors</div>
</section>
<h2>Done per day</h2>
<svg id="chart" role="img" aria-label="Done per day" preserveAspectRatio="none"></svg>
<h2>By tool</h2>
<table><thead><tr><th>Package</th><th>Tool</th><th>Kind</th><th class="n">Done</th><th class="n">Calls</th><th class="n">Errors</th></tr></thead><tbody id="rows"></tbody></table>
<p><button id="card">Save share card (PNG)</button></p>
<script>
const ENTRIES = ${JSON.stringify(entries).replace(/</g, "\\u003c")};
const READ = new RegExp(${JSON.stringify(READ.source)});
const DAY = 86400000;
const $ = (id) => document.getElementById(id);
const dayOf = (t) => new Date(t).toLocaleDateString("en-CA");
let range = ${days};
let shown = {};

const render = () => {
  const since = range ? Date.now() - range * DAY : 0;
  const list = ENTRIES.filter((e) => Date.parse(e.t) >= since);
  const isDone = (e) => e.ok && !READ.test(e.tool);
  const reads = list.filter((e) => READ.test(e.tool)).length;
  shown = {
    calls: list.length,
    done: list.filter(isDone).length,
    errors: list.filter((e) => !e.ok).length,
    label: range ? "last " + range + " days" : "all time",
  };
  $("done").textContent = shown.done;
  $("calls").textContent = shown.calls;
  $("reads").textContent = reads;
  $("writes").textContent = list.length - reads;
  $("errors").textContent = shown.errors;
  for (const b of document.querySelectorAll("nav button")) {
    b.setAttribute("aria-pressed", String(Number(b.dataset.days) === range));
  }

  const first = range ? since : list.reduce((m, e) => Math.min(m, Date.parse(e.t)), Date.now());
  const days = [];
  for (const d = new Date(first); dayOf(d) <= dayOf(Date.now()); d.setDate(d.getDate() + 1)) days.push(dayOf(d));
  const perDay = new Map(days.map((d) => [d, 0]));
  for (const e of list.filter(isDone)) perDay.set(dayOf(e.t), (perDay.get(dayOf(e.t)) ?? 0) + 1);
  const max = Math.max(1, ...perDay.values());
  const svg = $("chart");
  svg.setAttribute("viewBox", "0 0 " + days.length * 10 + " 100");
  svg.replaceChildren(...days.map((d, i) => {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const h = ((perDay.get(d) ?? 0) / max) * 100;
    r.setAttribute("x", i * 10 + 1);
    r.setAttribute("width", 8);
    r.setAttribute("y", 100 - h);
    r.setAttribute("height", h);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = d + ": " + (perDay.get(d) ?? 0) + " done";
    r.append(title);
    return r;
  }));

  const groups = new Map();
  for (const e of list) {
    const key = e.pkg + "|" + e.tool;
    const g = groups.get(key) ?? {calls: 0, done: 0, errors: 0, pkg: e.pkg, tool: e.tool};
    g.calls++;
    if (!e.ok) g.errors++;
    if (isDone(e)) g.done++;
    groups.set(key, g);
  }
  $("rows").replaceChildren(...[...groups.values()].sort((a, b) => b.calls - a.calls).map((g) => {
    const tr = document.createElement("tr");
    for (const [text, cls] of [[g.pkg], [g.tool], [READ.test(g.tool) ? "read" : "write"], [READ.test(g.tool) ? "" : g.done, "n"], [g.calls, "n"], [g.errors, "n"]]) {
      const td = document.createElement("td");
      td.textContent = text;
      if (cls) td.className = cls;
      tr.append(td);
    }
    return tr;
  }));
};

const saveCard = () => {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#000";
  g.font = "bold 56px Aptos, Segoe UI, sans-serif";
  g.fillText("Atlassian MCP usage", 80, 140);
  g.font = "32px Aptos, Segoe UI, sans-serif";
  g.fillText(shown.label + ", measured, not estimated", 80, 200);
  [["done", shown.done], ["calls", shown.calls], ["errors", shown.errors]].forEach(([name, n], i) => {
    g.font = "bold 120px Aptos, Segoe UI, sans-serif";
    g.fillText(String(n), 80 + i * 360, 400);
    g.font = "36px Aptos, Segoe UI, sans-serif";
    g.fillText(name, 80 + i * 360, 460);
  });
  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "atlassian-mcp-usage.png";
    a.click();
  });
};

for (const b of document.querySelectorAll("nav button")) {
  b.addEventListener("click", () => {
    range = Number(b.dataset.days);
    render();
  });
}
$("card").addEventListener("click", saveCard);
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
 * Registers usage_report, which reads the usage log of every package.
 * @param {any} server
 * @param {(file: string) => void} [open] tests pass a stub so no browser starts
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
        const since = Date.now() - days * DAY_MS;
        let text = textReport(
          all.filter((e) => Date.parse(e.t) >= since),
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
