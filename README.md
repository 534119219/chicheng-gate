# chicheng-gate

DSH Web GUI 插件：远程访问控制 + frpc 内网穿透 + 面板密码门禁 + 手机端 UI 适配。

在设置面板里统一管理：

- 远程访问：一键切换 Web GUI 绑定 0.0.0.0 / 127.0.0.1，让局域网设备可访问；关闭时自动还原所有修改。
- frpc 内网穿透：自动下载并拉起 frpc，把面板映射到公网 frps 服务器，可随时开/停。
- 面板密码门禁：非本机访问必须先通过密码验证（scrypt 加盐哈希 + 会话 cookie + 登录限速）。
- 手机端 UI：注入移动端适配 CSS。

---

## ⚠️ 安全警告（务必先读）

开启「远程访问」会把 Web GUI 绑定到 0.0.0.0（所有网卡），局域网内任何设备都能访问并操作你的 Harness（会话、文件、终端、凭据、代码执行等）。

开启「frpc 内网穿透」会把面板暴露到公网。强烈建议同时设置「面板密码」——本插件的密码门禁会对所有非本机访问（包括走 frp 隧道的访问）要求先登录。

- 仅在你信任的网络使用。
- 公网 / 不可信网络开启，等同于把完整控制权暴露给他人，请务必设置强密码。

---

## 功能特性

- 远程访问开关（默认关）：切换 0.0.0.0 与 127.0.0.1 绑定；关闭时还原全部修改。
- frpc 内网穿透（默认关，实时开关）：启动时自动从 GitHub Releases 下载 frpc（带 SHA256 校验，失败回退手动路径），生成 frpc.toml 并拉起；取消勾选立即停止。配置项：服务器地址/端口、token 验证、本机端口、远程端口。
- 面板密码门禁：非 127.0.0.1 来源必须先通过密码验证；密码只存加盐哈希，带登录限速（5 次/分/IP）与 7 天会话。
- 独立密码网关：frpc 隧道不直连 DSH，而是先经过一个本地密码网关（127.0.0.1 的「本机端口」，默认 3081），验证通过后才转发到 DSH 主端口 3080——这样公网隧道也需要密码，而本机 127.0.0.1 免密访问不受影响。
- 手机端 UI 调整（默认开）：注入移动端适配 CSS。
- 首次使用安全确认：阅读并确认风险后才解锁开关。
- crypto.randomUUID 补丁：修复局域网 HTTP 下 randomUUID 缺失。

## 截图

<table>
  <tr>
    <td align="center"><img src="assets/settings.png" alt="设置页" width="220"><br>设置页</td>
    <td align="center"><img src="assets/login-gate.png" alt="密码登录页" width="300"><br>密码登录页</td>
    <td align="center"><img src="assets/mobile-ui-1.png" alt="手机端 1" width="130"><br>手机端 1</td>
  </tr>
  <tr>
    <td align="center"><img src="assets/mobile-ui-2.png" alt="手机端 2" width="130"><br>手机端 2</td>
    <td align="center"><img src="assets/mobile-ui-3.png" alt="手机端 3" width="130"><br>手机端 3</td>
    <td></td>
  </tr>
</table>

---

## 安装

GitHub 安装：

    dsh plugin --profile web add github:534119219/chicheng-gate

安装后在 profile 的 package.json 里会得到：

    "dependencies": {
      "chicheng-gate": "github:534119219/chicheng-gate"
    }

---

## 使用

1. 打开 Web GUI → 设置 → 侧栏选「赤橙网关」。
2. 首次进入弹出安全确认，勾选「我已阅读并了解上述安全风险」→ 点「同意」。
3. 设置面板密码（推荐）：在「面板密码」卡片输入至少 8 位密码并保存。
4. 配置 frpc（如需公网访问）：在「内网穿透 (frpc)」卡片填服务器地址、端口、token、本机端口（默认 3081，不可用 3080）、远程端口。
5. 打开「远程访问」开关（局域网访问）和/或「启用 frpc」（公网访问）。
6. 重启 dsh web（远程访问和 frpc 配置改动需重启生效；frpc 的启用/停用开关本身是实时的）。
7. 访问：
   - 局域网：http://<本机IP>:3080
   - 公网（frpc 隧道）：http://<frps公网IP>:<远程端口> —— 首次会弹登录页，输入面板密码。

---

## 工作原理

- 主机侧（lib/index.js）：
  - 启动早期读取设置，提供 remoteAccess 服务（决定 webserver.host 与 connection.trustedHosts），并给 web-runtime 注入同一 trust 列表（供 /api 与 dsh-better-sidebar 等 fence 使用）。
  - 按开关应用/还原 3 处官方源码补丁（打补丁前自动备份 .chicheng-gate.bak，关闭时还原）：远程访问（connection 特权方法白名单、设置持久化 host）、手机端两步设置、设置侧栏网关图标。
  - 面板密码门禁：包住 HTTP server 的 request/upgrade，非本机访问要求会话 cookie；提供 /chicheng-gate/login、/chicheng-gate/logout、/chicheng-gate/password、/chicheng-gate/status、/chicheng-gate/restart 路由。
  - frpc 管理：自动下载/启动/停止 frpc（存放于 $DSH_HOME/frpc/，PID 记在 frpc.pid），按设置实时开关。
  - 独立密码网关：监听 127.0.0.1 的「本机端口」，反向代理（HTTP + WebSocket + SSE）到 DSH 主端口，复用同一套密码/会话。
- 客户端（lib/client.js）：在设置侧栏注册「赤橙网关」分区，卡片式渲染远程访问 / 面板密码 / frpc / 手机端 UI，通过 settingsScope 读写设置。

设置命名空间：chicheng-gate（写入 settings.yaml）：

    chicheng-gate:
      consented: false
      remoteEnabled: false
      mobileUi: true
      frpcEnabled: false
      frpcServerAddr: ""
      frpcServerPort: 7000
      frpcAuthMethod: token
      frpcToken: ""
      frpcLocalPort: 3081
      frpcRemotePort: 3080
      frpcPath: ""
      panelPasswordHash: ""

（panelPasswordHash 为 secret，settings 里只存哈希，不存明文。）

---

## 常见问题

- 改了远程访问 / frpc 配置没生效：需要重启 dsh web（frpc 的「启用」开关本身是实时的，无需重启）。
- 非本机访问（0.0.0.0 / 局域网 IP / 公网隧道）设置页报 `transport failure for /api/settings.describe: HTTP 403`：这是 DSH 的 /api 信任门禁。开启远程访问后，插件会把访问来源写进 connection 的 trustedHosts 并移除 settings 的特权限制，但**这些改动要重启 dsh web 才生效**——重启后 403 消失、设置与主题才会同步。
- frps 上不显示端口 / 公网打不开：检查 frpc 状态（设置页有实时状态），常见原因是「远程端口」在 frps 上被占用，或 frps 的 vhostHTTPPort 占用了同一个端口。换一个空闲端口即可。
- 公网能打开但弹登录页：正常，走隧道必须输入面板密码；本机 127.0.0.1 不需要。
- 登录限速按来源 IP 计数（5 次/分/IP）：公司/宿舍 NAT 下多台设备共享同一公网 IP，可能互相触发限速，稍等一分钟再试即可。

---

## License

MIT
