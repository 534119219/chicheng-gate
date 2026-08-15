import { networkInterfaces, homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import z from "schemastery";
import { spawn } from "node:child_process";

const name = "dsh-lan-gate";
const NS = "dsh-lan-gate";
const inject = [];

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
  mobileUi: z.boolean().default(true)
});

function readEarlySetting(field, fallback) {
  const home = process.env.DSH_HOME || join(homedir(), ".dsh");
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

function checkoutRoot() {
  const bin = process.argv[1];
  if (!bin) return null;
  return resolve(dirname(bin), "..");
}

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

// Always-on patch: expose this plugin's settings namespace to the Web client.
// The api gateway only serves namespaces listed in WEB_SETTINGS_NAMESPACES.
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
  const script = 'setTimeout(function () { try { process.kill(' + pid + '); } catch (e) {} setTimeout(function () { try { var c = require("child_process").spawn("cmd", ["/c", "dsh", "web"], { detached: true, stdio: "ignore", windowsHide: true }); c.unref(); } catch (e2) {} }, 1500); }, 2000);';
  console.error("[dsh-lan-gate] restart requested, pid=" + pid);
  try {
    const child = spawn(process.execPath, ["-e", script], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } catch (error) { console.error("[dsh-lan-gate] restart spawn failed:", error); }
}

function apply(ctx) {
  const enabled = readEarlySetting("remoteEnabled", false);
  const mobileUi = readEarlySetting("mobileUi", true);
  const dhcp = readEarlySetting("dhcpAddress", "");
  const host = enabled ? "0.0.0.0" : "127.0.0.1";
  const trustedHosts = enabled ? Array.from(new Set([...(typeof dhcp === "string" && dhcp !== "" ? [dhcp] : []), ...lanAddresses()])) : [];
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

  let current = { consented: false, remoteEnabled: false, dhcpAddress: "", mobileUi: true };

  ctx.inject(["settings"], (sctx) => {
    const scope = sctx.settings.register(NS, SettingsSchema);
    const refresh = () => { try { current = { ...current, ...(scope.get() || {}) }; } catch {} };
    refresh();
    scope.watch(() => refresh());
  });

  ctx.inject(["webServer"], (sctx) => {
    sctx.webServer.tapIndex((html) => {
      if (html.includes("data-dsh-lan-gate")) return html;
      const css = current.mobileUi !== false ? CSS : "";
      return html.replace("<head>", "<head>" + POLYFILL + css);
    });

    sctx.effect(() => sctx.webServer.register({
      kind: "prefix",
      path: "/lan-gate/restart",
      handler: async (req, res) => {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true }));
        restartDshWeb();
      }
    }), "dsh-lan-gate: restart route");
  });
}

export { apply, inject, name };
