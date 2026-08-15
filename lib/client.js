window.__ModuleLoader__.load({
  id: "dsh-lan-gate",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var React = require("react");
    var primitives = require("@deepseek-ai/dsh-client-ui-primitives");

    var createElement = React.createElement;
    var useSyncExternalStore = React.useSyncExternalStore;
    var useMemo = React.useMemo;
    var useState = React.useState;
    var useEffect = React.useEffect;

    var Button = primitives.Button;
    var RiskConfirmation = primitives.RiskConfirmation;
    var IconWarningOutline16 = primitives.IconWarningOutline16;

    var NS = "dsh-lan-gate";

    var zh = {
      nav: "Lan Gate",
      title: "Lan Gate",
      intro: "局域网 / 内网穿透访问、frpc 隧道与面板密码门禁。",
      consentTitle: "开启远程访问前的安全确认",
      consentDesc: "开启后 Web GUI 将绑定到 0.0.0.0，局域网内其他设备可通过 http://<本机IP>:3080 访问并操作你的 Harness（会话、文件、终端、凭据等）。仅在你信任的网络使用；公共/不可信网络开启等同于把控制权暴露给他人。插件会修改连接权限白名单、设置持久化、移动端两步设置三个官方文件（关闭时自动还原）。",
      consentAck: "我已阅读并了解上述安全风险",
      consentConfirm: "同意",
      cancel: "取消",
      restartButton: "一键重启",
      restartHint: "远程访问与 frpc 的改动重启后生效。",

      remoteTitle: "远程访问",
      remoteToggle: "绑定 0.0.0.0（局域网可访问）",
      remoteToggleDesc: "开启后需重启 dsh web 生效；关闭会还原修改过的文件和配置",

      frpcTitle: "内网穿透 (frpc)",
      frpcDesc: "dsh web 启动时自动拉起 frpc，把面板映射到公网 frps 服务器。修改后需重启生效。",
      frpcEnabled: "启用 frpc",
      frpcEnabledDesc: "启动时自动下载（失败则回退手动路径）并拉起 frpc",
      frpcServerAddr: "服务器地址",
      frpcServerAddrPh: "例如 frp.example.com 或 1.2.3.4",
      frpcServerPort: "服务器端口",
      frpcAuthMethod: "验证模式",
      authToken: "Token 验证",
      authNone: "无验证",
      frpcToken: "验证密钥 (token)",
      frpcTokenPh: "需与 frps 的 auth.token 一致",
      frpcRemotePort: "远程端口",
      frpcRemotePortHint: "外部网络访问端口",
      frpcLocalPort: "本机端口",
      frpcLocalPortHint: "安全端口设定，不可使用3080端口",
      frpcPath: "frpc 手动路径（可选）",
      frpcPathPh: "留空则自动下载；下载失败时回退到此路径",
      frpcStatus: "运行状态",
      frpcDisabled: "未启用",
      frpcRunning: "运行中",
      frpcNotRunning: "未运行",
      frpcError: "启动失败",
      frpcUnknown: "未知",

      pwTitle: "面板密码",
      pwDesc: "只要访问来源不是 127.0.0.1，就必须先通过密码验证，未验证前看不到任何 dsh web 内容。密码只存加盐哈希，绝不存明文，且带登录限速防爆破。",
      pwSet: "已设置面板密码",
      pwUnset: "未设置（非本机访问将被拦截）",
      pwNewPh: "输入新密码（至少 8 位）",
      pwSave: "保存密码",
      pwSaved: "已保存",
      pwEmpty: "密码不能为空",
      pwTooShort: "密码至少 8 位",
      pwError: "保存失败",

      mobileTitle: "手机端 UI",
      mobileToggle: "注入移动端适配 CSS",
      mobileToggleDesc: "侧栏覆盖、统计行对齐、两步设置等"
    };

    var en = {
      nav: "Lan Gate",
      title: "Lan Gate",
      intro: "LAN / tunnel access, frpc tunnel and a panel password gate.",
      consentTitle: "Security confirmation before enabling remote access",
      consentDesc: "Enabling binds the Web GUI to 0.0.0.0: other LAN devices can reach http://<this-ip>:3080 and operate your Harness (sessions, files, terminals, credentials). Use only on a trusted network. The plugin patches 3 official files (connection allowlist, settings persistence, mobile two-step settings) and restores them on disable.",
      consentAck: "I have read and understand the risks",
      consentConfirm: "Agree",
      cancel: "Cancel",
      restartButton: "Restart",
      restartHint: "Remote-access and frpc changes apply after a restart.",

      remoteTitle: "Remote access",
      remoteToggle: "Bind 0.0.0.0 (LAN reachable)",
      remoteToggleDesc: "Restart dsh web to apply; disabling restores modified files",

      frpcTitle: "Tunnel (frpc)",
      frpcDesc: "Auto-starts frpc on dsh web boot to map the panel to a public frps server. Restart to apply.",
      frpcEnabled: "Enable frpc",
      frpcEnabledDesc: "Auto-download on boot (manual path fallback), then launch frpc",
      frpcServerAddr: "Server address",
      frpcServerAddrPh: "e.g. frp.example.com or 1.2.3.4",
      frpcServerPort: "Server port",
      frpcAuthMethod: "Auth mode",
      authToken: "Token",
      authNone: "None",
      frpcToken: "Auth token",
      frpcTokenPh: "Must match frps auth.token",
      frpcRemotePort: "Remote port",
      frpcRemotePortHint: "External network access port",
      frpcLocalPort: "Local port",
      frpcLocalPortHint: "Secure port setting; 3080 cannot be used",
      frpcPath: "frpc manual path (optional)",
      frpcPathPh: "Leave empty to auto-download; falls back to this path on download failure",
      frpcStatus: "Status",
      frpcDisabled: "Disabled",
      frpcRunning: "Running",
      frpcNotRunning: "Not running",
      frpcError: "Failed to start",
      frpcUnknown: "Unknown",

      pwTitle: "Panel password",
      pwDesc: "Any request whose source is not 127.0.0.1 must pass password verification; nothing is served until then. The password is stored only as a salted hash, with login rate limiting.",
      pwSet: "Panel password is set",
      pwUnset: "Not set (non-loopback access is blocked)",
      pwNewPh: "New password (min 8 chars)",
      pwSave: "Save password",
      pwSaved: "Saved",
      pwEmpty: "Password cannot be empty",
      pwTooShort: "Password must be at least 8 characters",
      pwError: "Save failed",

      mobileTitle: "Mobile UI",
      mobileToggle: "Inject mobile CSS",
      mobileToggleDesc: "Sidebar overlay, stats alignment, two-step settings"
    };

    var sectionStyle = { flexDirection: "column", gap: "14px", width: "100%", display: "flex" };
    var cardStyle = { boxSizing: "border-box", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: "16px", flexDirection: "column", flex: "none", gap: "8px", padding: "18px 20px 20px", display: "flex" };
    var headingStyle = { color: "var(--dsw-alias-label-primary)", alignItems: "baseline", gap: "7px", padding: "0 2px 6px", fontSize: "13px", fontWeight: 600, lineHeight: "20px", display: "flex" };
    var rowStyle = { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", fontSize: "14px", color: "var(--dsw-alias-label-primary)" };
    var labelStyle = { display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 };
    var titleStyle = { fontWeight: 500 };
    var descStyle = { fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: 1.5 };
    var checkboxStyle = { width: 16, height: 16, cursor: "pointer", accentColor: "var(--dsw-alias-interactive-accent, #5b8cff)", flex: "none" };
    var textInputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", fontSize: "13px", outline: "none", fontFamily: "inherit" };
    var selectStyle = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", fontSize: "13px", outline: "none", fontFamily: "inherit" };
    var fieldLabelStyle = { fontSize: 13, color: "var(--dsw-alias-label-primary)", fontWeight: 500 };
    var statusDot = function (color) { return { width: 8, height: 8, borderRadius: "50%", background: color, flex: "none", display: "inline-block" }; };

    function ToggleRow(props) {
      return createElement("label", { style: Object.assign({}, rowStyle, props.style) },
        createElement("input", {
          type: "checkbox",
          checked: props.checked === true,
          disabled: props.disabled === true,
          onChange: function (e) { props.onChange(e.target.checked); },
          style: checkboxStyle
        }),
        createElement("span", { style: labelStyle },
          createElement("span", { style: titleStyle }, props.title),
          props.desc ? createElement("span", { style: descStyle }, props.desc) : null
        )
      );
    }

    function Field(props) {
      return createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        createElement("div", { style: fieldLabelStyle }, props.label),
        props.desc ? createElement("div", { style: descStyle }, props.desc) : null,
        props.children
      );
    }

    function Card(props) {
      return createElement("div", { style: cardStyle },
        createElement("div", { style: headingStyle }, props.heading),
        props.children
      );
    }

    function LanGateSection(props) {
      var scope = props.scope;
      var t = props.t;

      var subscribe = useMemo(function () { return function (cb) { return scope.subscribe(cb); }; }, [scope]);
      var getSnapshot = useMemo(function () { return function () { return scope.getSnapshot(); }; }, [scope]);
      var snap = useSyncExternalStore(subscribe, getSnapshot);

      var value = (snap && snap.value) || {};
      var consented = value.consented === true;
      var remoteEnabled = value.remoteEnabled === true;
      var mobileUi = value.mobileUi !== false;
      var frpcEnabled = value.frpcEnabled === true;
      var frpcAddr = typeof value.frpcServerAddr === "string" ? value.frpcServerAddr : "";
      var frpcPort = value.frpcServerPort == null ? "" : String(value.frpcServerPort);
      var authMethod = value.frpcAuthMethod === "none" ? "none" : "token";
      var frpcToken = typeof value.frpcToken === "string" ? value.frpcToken : "";
      var localPort = value.frpcLocalPort == null ? "" : String(value.frpcLocalPort);
      var remotePort = value.frpcRemotePort == null ? "" : String(value.frpcRemotePort);
      var frpcPath = typeof value.frpcPath === "string" ? value.frpcPath : "";

      var ackState = useState(false);
      var acknowledged = ackState[0];
      var setAcknowledged = ackState[1];

      var disState = useState(false);
      var dismissed = disState[0];
      var setDismissed = disState[1];

      var npState = useState("");
      var newPassword = npState[0];
      var setNewPassword = npState[1];

      var pmState = useState("");
      var pwMsg = pmState[0];
      var setPwMsg = pmState[1];

      var fsState = useState(null);
      var frpcStatus = fsState[0];
      var setFrpcStatus = fsState[1];

      var passwordSet = !!(frpcStatus && frpcStatus.passwordSet);

      var set = function (field, val) { scope.set(field, val); };

      var restartDsh = function () {
        fetch("/lan-gate/restart", { method: "POST", credentials: "same-origin" }).catch(function () {});
      };

      var savePassword = function () {
        if (!newPassword) { setPwMsg(t("pwEmpty")); return; }
        if (newPassword.length < 8) { setPwMsg(t("pwTooShort")); return; }
        fetch("/lan-gate/password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: newPassword })
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.ok) {
              setNewPassword("");
              setPwMsg(t("pwSaved"));
              setFrpcStatus(function (prev) { return prev ? Object.assign({}, prev, { passwordSet: true }) : { passwordSet: true }; });
            }
            else { setPwMsg((d && d.error) || t("pwError")); }
          })
          .catch(function () { setPwMsg(t("pwError")); });
      };

      useEffect(function () {
        var alive = true;
        var poll = function () {
          fetch("/lan-gate/status", { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (d) { if (alive) setFrpcStatus(d); })
            .catch(function () {});
        };
        poll();
        var timer = setInterval(poll, 5000);
        return function () { alive = false; clearInterval(timer); };
      }, []);

      var frpcRunning = !!(frpcStatus && frpcStatus.frpc && frpcStatus.frpc.running);
      var frpcErrorText = (frpcStatus && frpcStatus.frpc && frpcStatus.frpc.error) || "";
      var frpcPid = (frpcStatus && frpcStatus.frpc && frpcStatus.frpc.pid) || null;

      var statusText, statusColor;
      if (!frpcEnabled) { statusText = t("frpcDisabled"); statusColor = "var(--dsw-alias-label-tertiary)"; }
      else if (frpcErrorText) { statusText = t("frpcError") + ": " + frpcErrorText; statusColor = "#f2a1a1"; }
      else if (frpcRunning) { statusText = t("frpcRunning") + (frpcPid ? " (pid " + frpcPid + ")" : ""); statusColor = "#3fb96f"; }
      else { statusText = t("frpcNotRunning"); statusColor = "var(--dsw-alias-label-secondary)"; }

      return createElement("div", { style: sectionStyle },
        // header
        createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", padding: "2px 2px 0" } },
          createElement("div", { style: { flex: 1, minWidth: 0 } },
            createElement("div", { style: { fontSize: 16, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, t("title")),
            createElement("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary)", lineHeight: 1.5, marginTop: "4px" } }, t("intro"))
          ),
          createElement(Button, { size: "md", variant: "outline", onClick: restartDsh, style: { borderRadius: "8px", flex: "none", marginTop: "10px" } }, t("restartButton"))
        ),
        createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)", padding: "0 2px" } }, t("restartHint")),

        // card 1: remote access
        createElement(Card, { heading: t("remoteTitle") },
          createElement(ToggleRow, {
            checked: remoteEnabled,
            disabled: !consented,
            onChange: function (v) { set("remoteEnabled", v); },
            title: t("remoteToggle"),
            desc: t("remoteToggleDesc"),
            style: { padding: "2px 0" }
          })
        ),

        // card 2: panel password
        createElement(Card, { heading: t("pwTitle") },
          createElement("div", { style: descStyle }, t("pwDesc")),
          createElement("div", { style: { display: "flex", alignItems: "center", gap: "7px", padding: "2px 0" } },
            createElement("span", { style: statusDot(passwordSet ? "#3fb96f" : "#f2a1a1") }),
            createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, passwordSet ? t("pwSet") : t("pwUnset"))
          ),
          createElement(Field, { label: t("pwNewPh") },
            createElement("input", { value: newPassword, type: "password", placeholder: t("pwNewPh"), onChange: function (e) { setNewPassword(e.target.value); }, style: textInputStyle })
          ),
          createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
            createElement(Button, { size: "sm", variant: "primary", onClick: savePassword, style: { borderRadius: "8px" } }, t("pwSave")),
            pwMsg ? createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, pwMsg) : null
          )
        ),

        // card 3: frpc
        createElement(Card, { heading: t("frpcTitle") },
          createElement("div", { style: descStyle }, t("frpcDesc")),
          createElement(ToggleRow, {
            checked: frpcEnabled,
            disabled: !consented,
            onChange: function (v) { set("frpcEnabled", v); },
            title: t("frpcEnabled"),
            desc: t("frpcEnabledDesc"),
            style: { padding: "2px 0" }
          }),
          createElement("div", { style: { display: "flex", alignItems: "center", gap: "7px", padding: "2px 0" } },
            createElement("span", { style: statusDot(statusColor) }),
            createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("frpcStatus") + ": " + statusText)
          ),
          createElement(Field, { label: t("frpcServerAddr") },
            createElement("input", { value: frpcAddr, placeholder: t("frpcServerAddrPh"), onChange: function (e) { set("frpcServerAddr", e.target.value); }, style: textInputStyle })
          ),
          createElement(Field, { label: t("frpcServerPort") },
            createElement("input", { value: frpcPort, inputMode: "numeric", onChange: function (e) { var n = Number(e.target.value); set("frpcServerPort", Number.isFinite(n) ? n : 0); }, style: textInputStyle })
          ),
          createElement(Field, { label: t("frpcAuthMethod") },
            createElement("select", { value: authMethod, onChange: function (e) { set("frpcAuthMethod", e.target.value); }, style: selectStyle },
              createElement("option", { value: "token" }, t("authToken")),
              createElement("option", { value: "none" }, t("authNone"))
            )
          ),
          authMethod !== "none" ? createElement(Field, { label: t("frpcToken") },
            createElement("input", { value: frpcToken, type: "password", placeholder: t("frpcTokenPh"), onChange: function (e) { set("frpcToken", e.target.value); }, style: textInputStyle })
          ) : null,
          createElement("div", { style: { display: "flex", gap: "10px", alignItems: "flex-start" } },
            createElement("div", { style: { flex: 1, minWidth: 0 } },
              createElement(Field, { label: t("frpcLocalPort"), desc: t("frpcLocalPortHint") },
                createElement("input", { value: localPort, inputMode: "numeric", placeholder: "3081", onChange: function (e) { var n = Number(e.target.value); if (n === 3080) n = 3081; set("frpcLocalPort", Number.isFinite(n) ? n : 0); }, style: textInputStyle })
              )
            ),
            createElement("div", { style: { flex: 1, minWidth: 0 } },
              createElement(Field, { label: t("frpcRemotePort"), desc: t("frpcRemotePortHint") },
                createElement("input", { value: remotePort, inputMode: "numeric", placeholder: "3080", onChange: function (e) { var n = Number(e.target.value); set("frpcRemotePort", Number.isFinite(n) ? n : 0); }, style: textInputStyle })
              )
            )
          ),
          createElement(Field, { label: t("frpcPath"), desc: t("frpcPathPh") },
            createElement("input", { value: frpcPath, placeholder: t("frpcPathPh"), onChange: function (e) { set("frpcPath", e.target.value); }, style: textInputStyle })
          )
        ),

        // card 4: mobile UI
        createElement(Card, { heading: t("mobileTitle") },
          createElement(ToggleRow, {
            checked: mobileUi,
            onChange: function (v) { set("mobileUi", v); },
            title: t("mobileToggle"),
            desc: t("mobileToggleDesc"),
            style: { padding: "2px 0" }
          })
        ),

        createElement(RiskConfirmation, {
          open: !consented && !dismissed,
          title: t("consentTitle"),
          description: t("consentDesc"),
          acknowledgeLabel: t("consentAck"),
          cancelLabel: t("cancel"),
          confirmLabel: t("consentConfirm"),
          acknowledged: acknowledged,
          onAcknowledgedChange: setAcknowledged,
          onCancel: function () { setDismissed(true); },
          onConfirm: function () { set("consented", true); setDismissed(true); setAcknowledged(false); }
        })
      );
    }

    var inject = ["slots", "connection", "locale", "settingsScope"];

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "dsh-lan-gate: locale");
      var t = ctx.locale.bind(NS);
      var scope = ctx.get("settingsScope").bind({ namespace: NS });
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "lan-gate",
          order: 110,
          label: function () { return t("nav"); },
          inject: function () { return { scope: scope, t: t }; }
        }, LanGateSection);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
