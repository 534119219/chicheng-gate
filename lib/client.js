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

    var Button = primitives.Button;
    var RiskConfirmation = primitives.RiskConfirmation;
    var IconWarningOutline16 = primitives.IconWarningOutline16;

    var NS = "dsh-lan-gate";

    var zh = {
      nav: "远程访问",
      consentTitle: "开启远程访问前的安全确认",
      consentDesc: "开启后 Web GUI 将绑定到 0.0.0.0，局域网内其他设备可通过 http://<本机IP>:3080 访问并操作你的 Harness（会话、文件、终端、凭据等）。仅在你信任的网络使用；公共/不可信网络开启等同于把控制权暴露给他人。插件会修改连接权限白名单、设置持久化、移动端两步设置三个官方文件（关闭时自动还原）。",
      consentAck: "我已阅读并了解上述安全风险",
      consentConfirm: "同意",
      cancel: "取消",
      remoteTitle: "远程控制（0.0.0.0 访问）",
      remoteDesc: "开启后需重启 dsh web 生效；关闭会还原修改过的文件和配置",
      restartButton: "一键重启",
      mobileTitle: "手机端 UI 调整",
      mobileDesc: "注入移动端适配 CSS（侧栏覆盖、统计行对齐、两步设置等）"
    };

    var en = {
      nav: "Remote Access",
      consentTitle: "Security confirmation before enabling remote access",
      consentDesc: "Enabling binds the Web GUI to 0.0.0.0: other LAN devices can reach http://<this-ip>:3080 and operate your Harness (sessions, files, terminals, credentials). Use only on a trusted network. The plugin patches 3 official files (connection allowlist, settings persistence, mobile two-step settings) and restores them on disable.",
      consentAck: "I have read and understand the risks",
      consentConfirm: "Agree",
      cancel: "Cancel",
      remoteTitle: "Remote control (0.0.0.0 access)",
      remoteDesc: "Restart dsh web to apply; disabling restores modified files",
      restartButton: "Restart dsh web",
      mobileTitle: "Mobile UI adaptation",
      mobileDesc: "Inject mobile CSS (sidebar overlay, stats alignment, two-step settings)"
    };

    var rowStyle = { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", fontSize: "14px", color: "var(--dsw-alias-label-primary)" };
    var labelStyle = { display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 };
    var titleStyle = { fontWeight: 500 };
    var descStyle = { fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: 1.5 };
    var checkboxStyle = { width: 16, height: 16, cursor: "pointer", accentColor: "var(--dsw-alias-interactive-accent, #5b8cff)", flex: "none" };

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

    function RemoteAccessSection(props) {
      var scope = props.scope;
      var t = props.t;

      var subscribe = useMemo(function () { return function (cb) { return scope.subscribe(cb); }; }, [scope]);
      var getSnapshot = useMemo(function () { return function () { return scope.getSnapshot(); }; }, [scope]);
      var snap = useSyncExternalStore(subscribe, getSnapshot);

      var value = (snap && snap.value) || {};
      var consented = value.consented === true;
      var remoteEnabled = value.remoteEnabled === true;
      var mobileUi = value.mobileUi !== false;

      var ackState = useState(false);
      var acknowledged = ackState[0];
      var setAcknowledged = ackState[1];

      var disState = useState(false);
      var dismissed = disState[0];
      var setDismissed = disState[1];

      var set = function (field, val) { scope.set(field, val); };

      var restartDsh = function () {
        fetch("/lan-gate/restart", { method: "POST", credentials: "same-origin" }).catch(function () {});
      };

      return createElement("div", { className: "_WvWnq_section" },
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
        }),
        createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0" } },
          createElement(ToggleRow, {
            checked: remoteEnabled,
            disabled: !consented,
            onChange: function (v) { set("remoteEnabled", v); },
            title: t("remoteTitle"),
            desc: t("remoteDesc"),
            style: { flex: 1, padding: 0 }
          }),
          createElement(Button, { size: "sm", variant: "outline", onClick: restartDsh }, t("restartButton"))
        ),
        createElement(ToggleRow, {
          checked: mobileUi,
          onChange: function (v) { set("mobileUi", v); },
          title: t("mobileTitle"),
          desc: t("mobileDesc")
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
        }, RemoteAccessSection);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
