# dsh-lan-gate

DSH Web GUI 插件：**远程访问 / 局域网访问控制 + 手机端 UI 适配**。

在设置面板里一键开关 0.0.0.0 绑定，让手机等局域网设备能访问你的
DeepSeek Harness Web GUI；关闭后自动还原所有被修改的文件和配置。附带
DHCP 地址自动获取，以及一套手机端 UI 优化。

---

## ⚠️ 安全警告（务必先读）

开启「远程控制」会把 Web GUI 绑定到 0.0.0.0（所有网卡），局域网内
任何设备都可以通过 http://<本机IP>:3080 访问并**操作**你的 Harness
（会话、文件、终端、凭据、代码执行等）。

- 仅在你信任的网络（如家庭 Wi-Fi）使用。
- 在公共 / 不可信网络开启，等同于把完整控制权暴露给他人。
- 本插件不会做用户鉴权——它只做「是否允许局域网访问」的开关。

开启后插件会修改以下内容（关闭时自动还原）：

1. 配置（bundle patch 生效，重启后应用）：
   - webserver.host -> 0.0.0.0
   - connection.trustedHosts -> DHCP 地址 + 自动检测的局域网 IP
2. 4 处官方包源码补丁（按需，打补丁前自动备份，关闭时从备份还原）：
   - @deepseek-ai/dsh-client-connection/lib/index.js —— 连接权限白名单
   - @deepseek-ai/dsh-client-ui-settings/lib/client.js —— 设置持久化
   - @deepseek-ai/dsh-client-ui-settings-general/lib/client.js —— 移动端两步设置
   - @deepseek-ai/dsh-host-apiproxy/lib/index.js —— 暴露本插件设置命名空间

所有路径都通过运行时动态解析（process.argv[1] 推导 DSH 安装根 +
os.homedir() 回退），不写死用户名 / 绝对路径，换机器换用户也能用。

---

## 功能特性

- 远程控制开关（默认关）：切换 0.0.0.0 与 127.0.0.1 绑定；关闭时还原全部修改。
- DHCP 地址输入框 + 「自动获取」按钮：从服务器读取当前局域网 IP 填入。
- 手机端 UI 调整开关（默认开）：注入移动端适配 CSS。
- 首次使用安全确认：勾选「已阅读风险」并点「同意并启用」后才解锁远程开关。
- crypto.randomUUID 补丁：修复局域网 HTTP 下 randomUUID 缺失问题。

---

## 安装

本插件目前发布在 GitHub（尚未发布到 npm），用 GitHub 方式安装：

    dsh plugin --profile web add github:534119219/dsh-lan-gate

安装后在 profile 的 package.json 里会得到：

    "dependencies": {
      "dsh-lan-gate": "github:534119219/dsh-lan-gate"
    }

重启：dsh web（切换远程控制 / 手机端 UI 后也需要重启生效，因为 webserver 只在启动时绑定一次）。

---

## 使用

1. 打开 Web GUI → 右上角设置 → 侧栏选「远程访问」。
2. 首次进入会弹出安全确认：勾选「我已阅读并了解上述安全风险」，点「同意并启用」。
3. 打开「远程控制」开关；如需指定信任 IP，用「自动获取」填入 DHCP 地址。
4. 按需切换「手机端 UI 调整」。
5. 重启 dsh web，手机在同一局域网访问 http://<本机IP>:3080。

---

## 工作原理

- 主机侧（lib/index.js）：启动早期读取设置，提供 remoteAccess 服务
  （决定 webserver.host 与 connection.trustedHosts），按开关应用/还原源码补丁
  （带 .dsh-lan-gate.bak 备份），注入 polyfill 与移动端 CSS，注册
  /lan-gate/dhcp 路由。
- 客户端（lib/client.js）：在设置侧栏注册「远程访问」分区，渲染三个控件与
  安全确认弹窗，通过 settingsScope 读写设置。

设置命名空间：dsh-lan-gate（写入 settings.yaml）：

    dsh-lan-gate:
      consented: false
      remoteEnabled: false
      dhcpAddress: ""
      mobileUi: true

---

## 常见问题

- 改了开关没生效：需要重启 dsh web。
- 资源管理器 / 设置显示 403 或 HTTP 400：确认远程控制已开、DHCP 地址正确、
  trustedHosts 包含局域网 IP，并已重启。
- 换机器 / 换用户路径变了：本插件动态解析路径，无需手改。

---

## License

MIT
