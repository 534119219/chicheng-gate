import { networkInterfaces, homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync, openSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import z from "schemastery";

const name = "dsh-lan-gate";
const NS = "dsh-lan-gate";
const inject = [];

const GATEWAY_PORT = 3081;
const DSH_RESERVED_PORT = 3080;

function resolveGatewayPort(port) {
  const n = Number(port);
  if (!Number.isFinite(n) || n <= 0 || n === DSH_RESERVED_PORT) return GATEWAY_PORT;
  return n;
}

const POLYFILL = '<script>/* dsh-lan-gate */ (function(){try{var c=window.crypto;if(!c||typeof c.randomUUID==="function")return;var u=function(){var b=new Uint8Array(16);c.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;var h=[];for(var i=0;i<16;i++)h.push((b[i]+256).toString(16).slice(1));return h.slice(0,4).join("")+"-"+h.slice(4,6).join("")+"-"+h.slice(6,8).join("")+"-"+h.slice(8,10).join("")+"-"+h.slice(10,16).join("")};try{c.randomUUID=u}catch(e){try{Object.defineProperty(c,"randomUUID",{value:u,configurable:true,writable:true})}catch(e2){}}}catch(e){}})();</script>';

const CSS = '<style data-dsh-lan-gate-mobile>' +
  '.dsh-lan-back{display:none}' +
  '@media (hover:none){[role="tooltip"]{display:none !important}}' +
  '@media (hover: none) and (pointer: coarse){' +
    '.pI_x6G_frame[data-sidebar-collapsed]{grid-template-columns:0px minmax(0,1fr) 0px !important}' +
    '.hHd-Xa_collapsed .hHd-Xa_logoRow{position:fixed;top:10px;left:10px;z-index:60}' +
    '.hHd-Xa_collapsed .hHd-Xa_toggle .hHd-Xa_railFish{display:none !important}' +
    '.hHd-Xa_collapsed .hHd-Xa_toggle .hHd-Xa_panelIcon{display:block !important}' +
    '.pI_x6G_frame:not([data-sidebar-collapsed]){grid-template-columns:0px minmax(0,1fr) 0px !important}' +
    '.pI_x6G_frame:not([data-sidebar-collapsed]) .pI_x6G_sidebarCol{position:absolute !important;z-index:40;top:0;bottom:0;left:0;width:280px;box-shadow:0 8px 40px rgba(0,0,0,.35)}' +
    '.pI_x6G_frame:not([data-sidebar-collapsed]) .pI_x6G_centerCol{grid-column:2 !important}' +
    '.pI_x6G_frame:not([data-sidebar-collapsed]) .pI_x6G_detailsCol{grid-column:3 !important}' +
    '.pI_x6G_handle{display:none !important}' +
    '.p-xYUq_actions{flex-wrap:wrap;height:auto !important;gap:6px !important}' +
    '.p-xYUq_runTimeDot{margin:0 2px !important}' +
    '.p-xYUq_timeStart,.p-xYUq_timeEnd{order:-1;flex-basis:100%;padding-right:0 !important;padding-left:6px !important;padding-bottom:2px}' +
    '.wSkVaW_header{padding-left:56px !important}' +
    '.SVAs4q_label{font-size:0 !important;padding:0 3px !important}' +
    '.VOzbGW_panel[data-nav-only]{width:240px;height:auto;max-height:min(600px,calc(100vh - 48px))}' +
    '.VOzbGW_panel[data-nav-only] .VOzbGW_nav{width:100%}' +
    '.VOzbGW_panel[data-nav-only] .VOzbGW_content{display:none}' +
    '.VOzbGW_panel:not([data-nav-only]) .VOzbGW_nav{display:none}' +
    '.VOzbGW_overlay:has(.VOzbGW_panel[data-nav-only]){justify-content:flex-start;align-items:flex-end;padding:0 0 84px 12px}' +
    '.dsh-lan-back{display:inline-flex;box-sizing:border-box;cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0}' +
    '.dsh-lan-back:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '}' +
  '</style>';

const SettingsSchema = z.object({
  consented: z.boolean().default(false),
  remoteEnabled: z.boolean().default(false),
  dhcpAddress: z.string().default(""),
  mobileUi: z.boolean().default(true),
  frpcEnabled: z.boolean().default(false),
  frpcPath: z.string().default(""),
  frpcServerAddr: z.string().default(""),
  frpcServerPort: z.number().default(7000),
  frpcAuthMethod: z.string().default("token"),
  frpcToken: z.string().default(""),
  frpcLocalPort: z.number().default(3081),
  frpcRemotePort: z.number().default(3080),
  panelPasswordHash: z.string().role("secret").default("")
});

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}

function readEarlySetting(field, fallback) {
  const home = dshHome();
  if (!home) return fallback;
  let text;
  try { text = readFileSync(join(home, "settings.yaml"), "utf8"); } catch { return fallback; }
  const ls = text.split(/\r?\n/);
  let inNs = false;
  for (const line of ls) {
    if (new RegExp("^" + NS + "\\s*:").test(line)) { inNs = true; continue; }
    if (inNs) {
      if (/^\S/.test(line)) break;
      const m = line.match(new RegExp("^\\s+" + field + "\\s*:\\s*(.+)$"));
      if (m) {
        const v = m[1].trim();
        if (v === "true") return true;
        if (v === "false") return false;
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
        return v;
      }
    }
  }
  return fallback;
}

function lanAddresses() {
  return Object.values(networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

function parseHosts(s) {
  if (typeof s !== "string") return [];
  return s.split(/[\s,;]+/).map(function (h) {
    var t = h.trim();
    if (!t) return "";
    t = t.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
    t = t.split("/")[0].trim();
    return t;
  }).filter(function (t) {
    return /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(t) || /^\[[0-9a-fA-F:]+\](:\d{1,5})?$/.test(t);
  });
}

function checkoutRoot() {
  const bin = process.argv[1];
  if (!bin) return null;
  return resolve(dirname(bin), "..");
}

// ---------------------------------------------------------------------------
// Panel password auth: scrypt (memory-hard) + salt + constant-time compare.
// ---------------------------------------------------------------------------
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("密码至少需要 8 个字符 / password must be at least 8 characters");
  }
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string" || encoded.length === 0) return false;
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n < 16384 || n > (1 << 20) || r < 1 || r > 32 || p < 1 || p > 8) return false;
  let salt, expected;
  try {
    salt = Buffer.from(parts[4], "base64url");
    expected = Buffer.from(parts[5], "base64url");
  } catch { return false; }
  if (salt.length < 16 || expected.length < 16) return false;
  let actual;
  try {
    actual = scryptSync(password, salt, expected.length, { N: n, r, p });
  } catch { return false; }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function newSessionToken() { return randomBytes(32).toString("base64url"); }
function hashToken(token) { return createHash("sha256").update(token).digest("hex"); }

function parseCookies(header) {
  const out = Object.create(null);
  if (typeof header !== "string" || header.length === 0) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    let value = part.slice(idx + 1).trim();
    try { value = decodeURIComponent(value); } catch {}
    out[key] = value;
  }
  return out;
}

function cookieHeader(name, value, { maxAgeSec, httpOnly = true, sameSite = "Strict", path = "/" } = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) bits.push("HttpOnly");
  if (Number.isFinite(maxAgeSec)) bits.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`);
  return bits.join("; ");
}

function originMatchesHost(origin, host) {
  if (typeof origin !== "string" || origin.length === 0) return true;
  if (typeof host !== "string" || host.length === 0) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

class LoginLimiter {
  constructor({ windowMs = 60_000, maxFails = 5 } = {}) {
    this.windowMs = windowMs;
    this.maxFails = maxFails;
    this.hits = new Map();
  }
  allow(ip) {
    const now = Date.now();
    const row = this.hits.get(ip);
    if (row === undefined || now - row.start >= this.windowMs) {
      this.hits.set(ip, { start: now, fails: 0 });
      return true;
    }
    return row.fails < this.maxFails;
  }
  fail(ip) {
    const now = Date.now();
    const row = this.hits.get(ip);
    if (row === undefined || now - row.start >= this.windowMs) {
      this.hits.set(ip, { start: now, fails: 1 });
      return;
    }
    row.fails += 1;
  }
  succeed(ip) { this.hits.delete(ip); }
}

class SessionStore {
  constructor(ttlSec = 7 * 24 * 3600) {
    this.ttlSec = ttlSec;
    this.sessions = new Map();
  }
  issue() {
    const token = newSessionToken();
    this.sessions.set(hashToken(token), { exp: Date.now() + this.ttlSec * 1000 });
    return token;
  }
  get(token) {
    if (typeof token !== "string" || token.length < 16) return undefined;
    const id = hashToken(token);
    const row = this.sessions.get(id);
    if (row === undefined) return undefined;
    if (row.exp <= Date.now()) { this.sessions.delete(id); return undefined; }
    return row;
  }
  drop(token) {
    if (typeof token === "string") this.sessions.delete(hashToken(token));
  }
  dropAll() { this.sessions.clear(); }
}

// ---------------------------------------------------------------------------
// Peer helpers.
// ---------------------------------------------------------------------------
function normalizePeerIp(addr) {
  if (typeof addr !== "string" || addr.length === 0) return undefined;
  let ip = addr;
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1") return { kind: "loopback6", text: ip };
  if (isIpv4(ip)) return { kind: isLoopbackV4(ip) ? "loopback4" : "v4", text: ip };
  return { kind: "other", text: ip };
}

function isIpv4(ip) {
  const parts = ip.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function isLoopbackV4(ip) { return ip.split(".")[0] === "127"; }
function isLoopbackPeer(peer) { return peer !== undefined && (peer.kind === "loopback4" || peer.kind === "loopback6"); }

function pathnameOf(req) {
  try { return new URL(req.url ?? "/", "http://x").pathname; } catch { return "/"; }
}

const LOGIN_PATH = "/lan-gate/login";
const LOGOUT_PATH = "/lan-gate/logout";
const PASSWORD_PATH = "/lan-gate/password";
const STATUS_PATH = "/lan-gate/status";
const COOKIE_NAME = "dsh_lan_sess";

function isAuthPath(pathname) { return pathname === LOGIN_PATH || pathname === LOGOUT_PATH; }

function readBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readPassword(req) {
  const raw = await readBody(req);
  const type = String(req.headers["content-type"] || "");
  if (type.includes("application/json")) {
    try { return String(JSON.parse(raw).password || ""); } catch { return ""; }
  }
  for (const part of raw.split("&")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    if (part.slice(0, idx) !== "password") continue;
    try { return decodeURIComponent(part.slice(idx + 1).replace(/\+/g, " ")); } catch { return part.slice(idx + 1); }
  }
  return "";
}

function deny(res, reason, status = 403) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(`forbidden: ${reason}\n`);
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function html(res, status, body) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Login page (self-contained, no external assets, no dsh bundles).
// ---------------------------------------------------------------------------
function escapeHtml(v) {
  return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function loginPage({ error = "", lang = "zh" } = {}) {
  const zh = lang === "zh";
  const title = zh ? "Harness 面板登录" : "Harness panel login";
  const hint = zh
    ? "此面板已启用密码保护。输入面板密码以继续。未验证无法查看任何内容。"
    : "This panel is password-protected. Enter the panel password to continue. Nothing is served until you verify.";
  const pw = zh ? "面板密码" : "Panel password";
  const btn = zh ? "登录" : "Sign in";
  const err = error ? `<p class="err">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
    color:#e8eaf0;background:radial-gradient(1200px 800px at 20% -10%,#1c2438 0%,#0d0f16 55%,#08090d 100%)}
  .card{width:min(380px,calc(100vw - 36px));padding:26px 26px 24px;border-radius:18px;
    border:1px solid rgba(255,255,255,.09);background:rgba(20,22,30,.62);
    backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);
    box-shadow:0 24px 60px rgba(0,0,0,.45)}
  .logo{width:40px;height:40px;border-radius:12px;margin-bottom:14px;
    background:linear-gradient(135deg,#5b8cff,#7a5bff);display:flex;align-items:center;justify-content:center;
    color:#fff;font-weight:700;font-size:18px}
  h1{margin:0 0 8px;font-size:19px;font-weight:600}
  .hint{margin:0 0 16px;color:#9aa2b4;font-size:13px}
  label{display:block;margin:0 0 6px;font-size:13px;color:#c6cbd8}
  input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);
    background:rgba(0,0,0,.28);color:#eef0f6;font-size:14px;margin-bottom:14px;outline:none;
    transition:border-color .15s}
  input:focus{border-color:#5b8cff}
  button{width:100%;padding:11px 12px;border:0;border-radius:10px;cursor:pointer;
    background:linear-gradient(135deg,#5b8cff,#6a5bff);color:#fff;font-size:14px;font-weight:600;
    transition:opacity .15s}
  button:hover{opacity:.9}
  .err{color:#ff8a80;font-size:13px;margin:0 0 12px;padding:9px 12px;border-radius:8px;background:rgba(255,138,128,.1)}
</style>
</head>
<body>
  <form class="card" method="post" action="${LOGIN_PATH}" autocomplete="current-password">
    <div class="logo">LH</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="hint">${escapeHtml(hint)}</p>
    ${err}
    <label for="password">${pw}</label>
    <input id="password" name="password" type="password" minlength="8" required autofocus />
    <button type="submit">${escapeHtml(btn)}</button>
  </form>
</body>
</html>`;
}

function gateLang(req) {
  const al = String(req.headers["accept-language"] || "");
  return /^zh/i.test(al.trim()) ? "zh" : "en";
}

function installServerGate(server, decide) {
  const current = server.listeners("request");
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    const verdict = decide(req);
    req.__dshLanGate = verdict;
    if (!verdict.ok) {
      if (verdict.redirect && req.method === "GET" && !pathnameOf(req).startsWith("/api/")) {
        res.writeHead(302, { location: verdict.redirect, "cache-control": "no-store" });
        res.end();
        return;
      }
      deny(res, verdict.reason, verdict.status ?? 403);
      return;
    }
    for (const listener of current) listener.call(server, req, res);
  });
  const upgrades = server.listeners("upgrade");
  server.removeAllListeners("upgrade");
  server.on("upgrade", (req, socket, head) => {
    const verdict = decide(req);
    if (!verdict.ok) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    for (const listener of upgrades) listener.call(server, req, socket, head);
  });
  return () => {
    server.removeAllListeners("request");
    for (const listener of current) server.on("request", listener);
    server.removeAllListeners("upgrade");
    for (const listener of upgrades) server.on("upgrade", listener);
  };
}

// ---------------------------------------------------------------------------
// frpc integration.
// ---------------------------------------------------------------------------
const FRPC_UA = { "User-Agent": "dsh-lan-gate" };

function frpcDir() { return join(dshHome(), "frpc"); }
function frpcBinaryName() { return process.platform === "win32" ? "frpc.exe" : "frpc"; }

function platformKey() {
  const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "linux";
  let arch = process.arch;
  if (arch === "x64") arch = "amd64";
  if (arch === "ia32") arch = "386";
  return { os, arch };
}

function buildFrpcToml(cfg) {
  const L = [];
  L.push(`serverAddr = ${JSON.stringify(String(cfg.frpcServerAddr || ""))}`);
  L.push(`serverPort = ${Number(cfg.frpcServerPort) || 7000}`);
  L.push(`loginFailExit = false`);
  if (cfg.frpcAuthMethod !== "none") {
    L.push(`auth.method = "token"`);
    L.push(`auth.token = ${JSON.stringify(String(cfg.frpcToken || ""))}`);
  }
  L.push("");
  L.push("[[proxies]]");
  L.push(`name = "dsh-web"`);
  L.push(`type = "tcp"`);
  L.push(`localIP = "127.0.0.1"`);
  L.push(`localPort = ${resolveGatewayPort(cfg.frpcLocalPort)}`);
  L.push(`remotePort = ${Number(cfg.frpcRemotePort) || 3080}`);
  L.push("");
  return L.join("\n");
}

async function downloadTo(url, dest) {
  const res = await fetch(url, { headers: FRPC_UA, redirect: "follow" });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf;
}

function findBinary(dir, binName) {
  const queue = [dir];
  let depth = 0;
  while (queue.length > 0 && depth < 6) {
    const next = [];
    for (const d of queue) {
      let entries;
      try { entries = readdirSync(d); } catch { continue; }
      for (const e of entries) {
        const full = join(d, e);
        let st;
        try { st = statSync(full); } catch { continue; }
        if (st.isDirectory()) { next.push(full); continue; }
        if (e === binName) return full;
      }
    }
    queue.splice(0, queue.length, ...next);
    depth += 1;
  }
  return undefined;
}

function extractArchive(archivePath, destDir) {
  if (process.platform === "win32") {
    // Windows ships PowerShell's Expand-Archive for zip (bsdtar/gnu tar can't be assumed).
    const ps = `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
    execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "ignore" });
  } else {
    execFileSync("tar", ["-xzf", archivePath, "-C", destDir], { stdio: "ignore" });
  }
}

// 1b: auto-download frpc from GitHub Releases with SHA256 verification.
async function downloadFrpc() {
  const dir = frpcDir();
  mkdirSync(dir, { recursive: true });
  const { os, arch } = platformKey();

  const relRes = await fetch("https://api.github.com/repos/fatedier/frp/releases/latest", { headers: FRPC_UA, redirect: "follow" });
  if (!relRes.ok) throw new Error(`GitHub API HTTP ${relRes.status}`);
  const rel = await relRes.json();
  const tag = rel.tag_name;
  const ver = String(tag).replace(/^v/, "");
  const ext = os === "windows" ? "zip" : "tar.gz";
  const assetName = `frp_${ver}_${os}_${arch}.${ext}`;
  const asset = (rel.assets || []).find((a) => a.name === assetName);
  if (!asset) throw new Error(`未找到适用于 ${os}/${arch} 的 frp 发行包 (${assetName})`);

  const tmp = join(dir, assetName);
  const buf = await downloadTo(asset.browser_download_url, tmp);

  // SHA256 verification against the release checksums file.
  try {
    const chkRes = await fetch(`https://github.com/fatedier/frp/releases/download/${tag}/frp_sha256_checksums.txt`, { headers: FRPC_UA, redirect: "follow" });
    if (chkRes.ok) {
      const chkText = await chkRes.text();
      const line = chkText.split(/\r?\n/).find((l) => l.trim().endsWith("  " + assetName) || l.trim().endsWith(" " + assetName) || l.trim().includes(assetName));
      if (line) {
        const want = line.trim().split(/\s+/)[0];
        const got = createHash("sha256").update(buf).digest("hex");
        if (want && want.toLowerCase() !== got) {
          throw new Error(`frp SHA256 校验失败 (期望 ${want} 实际 ${got})`);
        }
      }
    }
  } catch (e) {
    throw new Error("SHA256 校验失败: " + e.message);
  }

  const extracted = join(dir, ver);
  mkdirSync(extracted, { recursive: true });
  try {
    extractArchive(tmp, extracted);
  } catch (e) {
    throw new Error("解压失败: " + e.message);
  }
  const bin = findBinary(extracted, frpcBinaryName());
  if (!bin) throw new Error("压缩包中未找到 frpc 二进制");
  const dest = join(dir, frpcBinaryName());
  copyFileSync(bin, dest);
  return dest;
}

// Resolve frpc binary: 1b (auto-download) first, 1a (manual path) fallback.
async function resolveFrpcBinary(cfg) {
  const cached = join(frpcDir(), frpcBinaryName());
  if (existsSync(cached)) return cached;
  try {
    return await downloadFrpc();
  } catch (downloadErr) {
    if (typeof cfg.frpcPath === "string" && cfg.frpcPath.trim() !== "" && existsSync(cfg.frpcPath.trim())) {
      return cfg.frpcPath.trim();
    }
    throw new Error("frpc 自动下载失败，且未配置有效的手动路径(frpcPath)。下载错误: " + downloadErr.message);
  }
}

function killFrpcPid(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/F"], { stdio: "ignore" });
    } else {
      process.kill(Number(pid), "SIGKILL");
    }
  } catch {}
}

// Kill a plugin-managed frpc left over from a previous dsh web run (taskkill /F
// on the parent does not reap children on Windows). Only the PID we recorded in
// frpc.pid is touched — never the user's own frpc elsewhere.
function killStaleFrpc() {
  const pidFile = join(frpcDir(), "frpc.pid");
  try {
    if (existsSync(pidFile)) {
      const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
      killFrpcPid(pid);
    }
  } catch {}
  try { writeFileSync(pidFile, "", "utf8"); } catch {}
}

function readFrpcLogError() {
  try {
    const logFile = join(frpcDir(), "frpc.log");
    if (!existsSync(logFile)) return null;
    const text = readFileSync(logFile, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(/start error:\s*(.+)/);
      if (m) return m[1].trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function startFrpc(cfg, onState) {
  const bin = await resolveFrpcBinary(cfg);
  const tomlPath = join(frpcDir(), "frpc.toml");
  writeFileSync(tomlPath, buildFrpcToml(cfg), "utf8");
  killStaleFrpc();
  const logFd = openSync(join(frpcDir(), "frpc.log"), "w");
  const child = spawn(bin, ["-c", tomlPath], { stdio: ["ignore", logFd, logFd], windowsHide: true });
  try { writeFileSync(join(frpcDir(), "frpc.pid"), String(child.pid), "utf8"); } catch {}
  onState({ running: true, pid: child.pid, path: bin, error: null });
  setTimeout(() => {
    if (child.exitCode !== null) return;
    const err = readFrpcLogError();
    if (err) onState({ running: true, pid: child.pid, path: bin, error: err });
  }, 3000);
  child.on("error", (e) => onState({ running: false, pid: null, path: bin, error: e.message }));
  child.on("exit", (code) => {
    const err = code === 0 || code === null ? null : `frpc 退出码 ${code}`;
    onState({ running: false, pid: null, path: bin, error: err });
  });
  return child;
}

// ---------------------------------------------------------------------------
// Source patches (unchanged from upstream).
// ---------------------------------------------------------------------------
const REMOTE_PATCHES = [
  {
    file: "node_modules/@deepseek-ai/dsh-client-connection/lib/index.js",
    apply: (text) => text.replace(/^\t*"(settings|agentPreset)\.[^"]*",?\s*\n/gm, "")
  },
  {
    file: "node_modules/@deepseek-ai/dsh-client-ui-settings/lib/client.js",
    apply: (text) => text.replace('connection.isLoopback ? "host" : "memory"', '"host"')
  }
];

const BACK_BUTTON = '(0, react_jsx_runtime.jsx)("button", {\n        type: "button",\n        className: "dsh-lan-back",\n        "aria-label": "Back",\n        onClick: () => {\n          onSelect(void 0);\n        },\n        children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, { size: 16 })\n      }), ';

const MOBILE_PATCHES = [
  {
    file: "node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js",
    apply: (text) => {
      text = text.replace('?.id ?? rows[0]?.id;', '?.id ?? (typeof matchMedia !== "undefined" && matchMedia("(hover: none) and (pointer: coarse)").matches ? void 0 : rows[0]?.id);');
      text = text.replace(/(className: SettingsRoot_module_css_default\.panel,)(\s*)(role: "dialog",)/, '$1$2"data-nav-only": active === void 0 || void 0,$2$3');
      text = text.replace(/(children: \[\s*)\(0, react_jsx_runtime\.jsx\)\("div", \{\s*className: SettingsRoot_module_css_default\.actions,/, '$1' + BACK_BUTTON + '(0, react_jsx_runtime.jsx)("div", {\n        className: SettingsRoot_module_css_default.actions,');
      return text;
    }
  }
];

const ALWAYS_PATCHES = [
  {
    file: "node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js",
    apply: (text) => text.replace('"ui-theme",\n\t"web-search-deepseek"\n];', '"ui-theme",\n\t"web-search-deepseek",\n\t"dsh-lan-gate"\n];')
  }
];

function applyPatches(root, patches) {
  for (const patch of patches) {
    const file = join(root, patch.file);
    if (!existsSync(file)) { console.warn("[dsh-lan-gate] patch target missing: " + file); continue; }
    const bak = file + ".dsh-lan-gate.bak";
    const text = readFileSync(file, "utf8");
    if (!existsSync(bak)) writeFileSync(bak, text, "utf8");
    const next = patch.apply(text);
    if (next !== text) writeFileSync(file, next, "utf8");
  }
}

function revertPatches(root, patches) {
  for (const patch of patches) {
    const file = join(root, patch.file);
    const bak = file + ".dsh-lan-gate.bak";
    if (existsSync(bak)) writeFileSync(file, readFileSync(bak, "utf8"), "utf8");
  }
}

function restartDshWeb() {
  const pid = process.pid;
  const script = 'setTimeout(function () { try { require("child_process").spawn("taskkill", ["/F", "/PID", "' + pid + '"], { stdio: "ignore" }); } catch (e) {} setTimeout(function () { try { var c = require("child_process").spawn("cmd", ["/c", "dsh", "web"], { detached: true, stdio: "ignore", windowsHide: true }); c.unref(); } catch (e2) {} }, 2500); }, 2000);';
  console.error("[dsh-lan-gate] restart requested, pid=" + pid);
  try {
    const child = spawn(process.execPath, ["-e", script], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } catch (error) { console.error("[dsh-lan-gate] restart spawn failed:", error); }
}

const HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "content-length"]);

function stripHopHeaders(headers) {
  const out = {};
  for (const key of Object.keys(headers)) {
    if (HOP_HEADERS.has(key)) continue;
    out[key] = headers[key];
  }
  return out;
}

function startTunnelGateway(opts) {
  const sessions = opts.sessions;
  const limiter = opts.limiter;
  const passwordHash = opts.passwordHash;
  const upstreamPort = opts.upstreamPort;
  const listenPort = opts.listenPort;

  const server = createServer();

  server.on("request", async (req, res) => {
    try {
      const path = pathnameOf(req);

      if (path === LOGIN_PATH) {
        if (req.method === "GET") {
          html(res, 200, loginPage({ lang: gateLang(req) }));
          return;
        }
        if (req.method !== "POST") {
          res.writeHead(405, { allow: "GET, POST" });
          res.end();
          return;
        }
        if (!originMatchesHost(req.headers.origin, req.headers.host)) {
          deny(res, "bad-origin", 403);
          return;
        }
        const peerIp = req.socket?.remoteAddress || "unknown";
        if (!limiter.allow(peerIp)) {
          html(res, 429, loginPage({ error: gateLang(req) === "zh" ? "尝试次数过多，请一分钟后再试。" : "Too many attempts. Wait a minute.", lang: gateLang(req) }));
          return;
        }
        const password = await readPassword(req);
        const hash = passwordHash();
        if (!hash) {
          html(res, 403, loginPage({ error: gateLang(req) === "zh" ? "面板密码尚未设置，请先在 127.0.0.1 本机设置。" : "No panel password set. Set one from 127.0.0.1 first.", lang: gateLang(req) }));
          return;
        }
        if (!verifyPassword(password, hash)) {
          limiter.fail(peerIp);
          html(res, 401, loginPage({ error: gateLang(req) === "zh" ? "密码错误。" : "Wrong password.", lang: gateLang(req) }));
          return;
        }
        limiter.succeed(peerIp);
        const token = sessions.issue();
        res.writeHead(302, { location: "/", "set-cookie": cookieHeader(COOKIE_NAME, token, { maxAgeSec: 7 * 24 * 3600 }) });
        res.end();
        return;
      }

      if (path === LOGOUT_PATH) {
        const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
        sessions.drop(token);
        res.writeHead(302, { location: LOGIN_PATH, "set-cookie": cookieHeader(COOKIE_NAME, "", { maxAgeSec: 0 }) });
        res.end();
        return;
      }

      const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
      if (sessions.get(token) === undefined) {
        if (req.method === "GET" && !path.startsWith("/api/")) {
          res.writeHead(302, { location: LOGIN_PATH, "cache-control": "no-store" });
          res.end();
        } else {
          deny(res, "auth", 401);
        }
        return;
      }

      const upstream = httpRequest({
        hostname: "127.0.0.1",
        port: upstreamPort,
        method: req.method,
        path: req.url,
        headers: stripHopHeaders(req.headers)
      }, (upRes) => {
        res.writeHead(upRes.statusCode, stripHopHeaders(upRes.headers));
        upRes.pipe(res);
      });
      upstream.on("error", () => { try { res.writeHead(502); res.end("bad gateway"); } catch {} });
      req.pipe(upstream);
    } catch (error) {
      try { deny(res, "gateway-error", 500); } catch {}
    }
  });

  server.on("upgrade", (req, socket, head) => {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (sessions.get(token) === undefined) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const upstream = httpRequest({
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers: req.headers
    });
    upstream.on("upgrade", (upRes, upSocket, upHead) => {
      let headStr = "HTTP/1.1 101 Switching Protocols\r\n";
      for (const [k, v] of Object.entries(upRes.headers)) headStr += k + ": " + v + "\r\n";
      headStr += "\r\n";
      socket.write(headStr);
      if (upHead && upHead.length) socket.write(upHead);
      if (head && head.length) upSocket.write(head);
      socket.pipe(upSocket);
      upSocket.pipe(socket);
    });
    upstream.on("error", () => socket.destroy());
    upstream.end();
  });

  server.listen(listenPort, "127.0.0.1", () => {
    console.error("[dsh-lan-gate] tunnel gateway listening on 127.0.0.1:" + listenPort);
  });

  return server;
}

function apply(ctx) {
  const initial = {
    consented: readEarlySetting("consented", false) === true,
    remoteEnabled: readEarlySetting("remoteEnabled", false) === true,
    dhcpAddress: readEarlySetting("dhcpAddress", "") || "",
    mobileUi: readEarlySetting("mobileUi", true) !== false,
    frpcEnabled: readEarlySetting("frpcEnabled", false) === true,
    frpcPath: readEarlySetting("frpcPath", "") || "",
    frpcServerAddr: readEarlySetting("frpcServerAddr", "") || "",
    frpcServerPort: Number(readEarlySetting("frpcServerPort", 7000)) || 7000,
    frpcAuthMethod: readEarlySetting("frpcAuthMethod", "token") || "token",
    frpcToken: readEarlySetting("frpcToken", "") || "",
    frpcLocalPort: Number(readEarlySetting("frpcLocalPort", 3081)) || 3081,
    frpcRemotePort: Number(readEarlySetting("frpcRemotePort", 3080)) || 3080,
    panelPasswordHash: readEarlySetting("panelPasswordHash", "") || ""
  };

  const enabled = initial.remoteEnabled;
  const mobileUi = initial.mobileUi;
  const dhcp = initial.dhcpAddress;
  const host = enabled ? "0.0.0.0" : "127.0.0.1";
  const trustedHosts = enabled ? Array.from(new Set([...(typeof dhcp === "string" && dhcp !== "" ? [dhcp] : []), ...lanAddresses(), "0.0.0.0", ...parseHosts(initial.frpcServerAddr)])) : [];
  ctx.provide("remoteAccess", { host, trustedHosts });

  const root = checkoutRoot();
  if (root) {
    try {
      applyPatches(root, ALWAYS_PATCHES);
      (enabled ? applyPatches : revertPatches)(root, REMOTE_PATCHES);
      (mobileUi ? applyPatches : revertPatches)(root, MOBILE_PATCHES);
    } catch (error) { console.error("[dsh-lan-gate] source patch error:", error); }
  } else {
    console.error("[dsh-lan-gate] cannot locate harness checkout; source patches skipped");
  }

  let current = { ...initial };
  let settingsScope = null;

  const sessions = new SessionStore({ ttlSec: 7 * 24 * 3600 });
  const limiter = new LoginLimiter();
  const frpcState = { enabled: initial.frpcEnabled, running: false, pid: null, path: null, error: null };
  let frpcChild = null;
  let frpcOpToken = 0;

  const applyFrpcState = async () => {
    const token = ++frpcOpToken;
    killStaleFrpc();
    if (frpcChild) { try { frpcChild.kill(); } catch {} frpcChild = null; }
    Object.assign(frpcState, { running: false, pid: null, path: null, error: null });
    frpcState.enabled = current.frpcEnabled === true;

    if (!current.frpcEnabled) return;

    const cfg = { ...current };
    try {
      const child = await startFrpc(cfg, (s) => Object.assign(frpcState, s));
      if (token !== frpcOpToken) { try { child.kill(); } catch {} return; }
      frpcChild = child;
    } catch (e) {
      frpcState.running = false;
      frpcState.error = e.message;
      console.error("[dsh-lan-gate] frpc start failed:", e.message);
    }
  };

  const sessionOk = (req) => sessions.get(parseCookies(req.headers.cookie)[COOKIE_NAME]) !== undefined;

  const decide = (req) => {
    const peer = normalizePeerIp(req.socket?.remoteAddress);
    if (peer === undefined) return { ok: false, reason: "no-peer", status: 403, peer };
    const loopback = isLoopbackPeer(peer);
    const path = pathnameOf(req);
    if (isAuthPath(path)) return { ok: true, authPath: true, peer, loopback };
    if (loopback) return { ok: true, reason: "loopback", peer, loopback };
    if (!current.panelPasswordHash) return { ok: false, reason: "password-unset", status: 403, peer, loopback };
    if (sessionOk(req)) return { ok: true, reason: "session", peer, loopback };
    return { ok: false, reason: "auth", status: 401, redirect: LOGIN_PATH, peer, loopback };
  };

  ctx.inject(["settings"], (sctx) => {
    settingsScope = sctx.settings.register(NS, SettingsSchema);
    const refresh = () => {
      try {
        const next = { ...current, ...(settingsScope.get() || {}) };
        const frpcChanged = next.frpcEnabled !== current.frpcEnabled;
        current = next;
        if (frpcChanged) applyFrpcState();
      } catch {}
    };
    refresh();
    settingsScope.watch(() => refresh());
  });

  ctx.inject(["webServer"], (sctx) => {
    const server = sctx.webServer.server;

    const tunnelGateway = startTunnelGateway({ sessions, limiter, passwordHash: () => current.panelPasswordHash, listenPort: resolveGatewayPort(current.frpcLocalPort), upstreamPort: sctx.webServer.port || 3080 });
    sctx.effect(() => () => { try { tunnelGateway.close(); } catch {} }, "dsh-lan-gate: tunnel gateway");

    sctx.effect(() => installServerGate(server, decide), "dsh-lan-gate: gate");

    sctx.webServer.tapIndex((html) => {
      if (html.includes("data-dsh-lan-gate")) return html;
      const css = current.mobileUi !== false ? CSS : "";
      return html.replace("<head>", "<head>" + POLYFILL + css);
    });

    sctx.webServer.register({
      kind: "prefix",
      path: "/lan-gate/restart",
      handler: async (req, res) => {
        json(res, 200, { ok: true });
        restartDshWeb();
      }
    });

    sctx.webServer.register({
      kind: "prefix",
      path: LOGIN_PATH,
      handler: async (req, res) => {
        const path = pathnameOf(req);
        const peerIp = (req.__dshLanGate?.peer?.text) || req.socket?.remoteAddress || "unknown";

        if (req.method === "GET") {
          html(res, 200, loginPage({ lang: gateLang(req) }));
          return;
        }

        if (req.method !== "POST") {
          res.writeHead(405, { allow: "GET, POST" });
          res.end();
          return;
        }

        if (!originMatchesHost(req.headers.origin, req.headers.host)) {
          deny(res, "bad-origin", 403);
          return;
        }
        if (!limiter.allow(peerIp)) {
          html(res, 429, loginPage({ error: gateLang(req) === "zh" ? "尝试次数过多，请一分钟后再试。" : "Too many attempts. Wait a minute.", lang: gateLang(req) }));
          return;
        }
        const password = await readPassword(req);
        if (!current.panelPasswordHash) {
          html(res, 403, loginPage({ error: gateLang(req) === "zh" ? "面板密码尚未设置，请先在 127.0.0.1 本机设置。" : "No panel password set. Set one from 127.0.0.1 first.", lang: gateLang(req) }));
          return;
        }
        if (!verifyPassword(password, current.panelPasswordHash)) {
          limiter.fail(peerIp);
          html(res, 401, loginPage({ error: gateLang(req) === "zh" ? "密码错误。" : "Wrong password.", lang: gateLang(req) }));
          return;
        }
        limiter.succeed(peerIp);
        const token = sessions.issue();
        res.writeHead(302, { location: "/", "set-cookie": cookieHeader(COOKIE_NAME, token, { maxAgeSec: 7 * 24 * 3600 }) });
        res.end();
      }
    });

    sctx.webServer.register({
      kind: "prefix",
      path: LOGOUT_PATH,
      handler: async (req, res) => {
        const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
        sessions.drop(token);
        res.writeHead(302, { location: LOGIN_PATH, "set-cookie": cookieHeader(COOKIE_NAME, "", { maxAgeSec: 0 }) });
        res.end();
      }
    });

    sctx.webServer.register({
      kind: "prefix",
      path: PASSWORD_PATH,
      handler: async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { allow: "POST" });
          res.end();
          return;
        }
        if (!originMatchesHost(req.headers.origin, req.headers.host)) {
          deny(res, "bad-origin", 403);
          return;
        }
        const password = await readPassword(req);
        if (password === "") {
          json(res, 400, { ok: false, error: "empty-password" });
          return;
        }
        try {
          const hash = hashPassword(password);
          await settingsScope?.update({ panelPasswordHash: hash });
          current.panelPasswordHash = hash;
          sessions.dropAll();
          json(res, 200, { ok: true, passwordSet: true });
        } catch (err) {
          json(res, 400, { ok: false, error: err.message });
        }
      }
    });

    sctx.webServer.register({
      kind: "prefix",
      path: STATUS_PATH,
      handler: async (req, res) => {
        json(res, 200, {
          passwordSet: Boolean(current.panelPasswordHash),
          frpc: {
            enabled: current.frpcEnabled,
            running: frpcState.running,
            pid: frpcState.pid,
            path: frpcState.path,
            error: frpcState.error
          }
        });
      }
    });

    // frpc start/stop follows the frpcEnabled setting (boot + real-time toggle).
    applyFrpcState();

    sctx.effect(() => () => {
      if (frpcChild) { try { frpcChild.kill(); } catch {} }
      killStaleFrpc();
    }, "dsh-lan-gate: frpc cleanup");
  });
}

export { apply, inject, name };
