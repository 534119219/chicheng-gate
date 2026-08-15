# dsh-remote-access

DSH Web GUI plugin: 远程访问 / 局域网访问控制 + 手机端 UI 适配。

## 安全警告（安装前必读）

开启「远程控制」会把 Web GUI 绑定到 0.0.0.0（所有网卡），使局域网内
其他设备可以通过 http://<本机IP>:3080 访问、操作你的 Harness（会话、
文件、终端、凭据等）。仅在你信任的网络（如家庭 Wi-Fi）使用；在公共/
不可信网络开启等同于把控制权暴露给他人。

开启后，插件会修改以下文件（关闭时自动还原）：

1. 配置（bundle patch 生效）：
   - webserver.host -> 0.0.0.0
   - connection.trustedHosts -> DHCP 地址 + 自动检测的局域网 IP
2. 官方包源码补丁（按需，带备份，关闭时还原）：
   - @deepseek-ai/dsh-client-connection/lib/index.js（连接权限白名单）
   - @deepseek-ai/dsh-client-ui-settings/lib/client.js（设置持久化）
   - @deepseek-ai/dsh-client-ui-settings-general/lib/client.js（移动端两步设置）

路径全部通过运行时动态解析，不写死用户名/绝对路径。

## 设置项（设置 → 远程访问）

- 远程控制（默认关）：开关 0.0.0.0 访问。切换后需重启 dsh web 生效。
- DHCP 地址：本机局域网 IP；右侧「自动获取」从服务器读取当前地址填入。
- 手机端 UI 调整（默认开）：注入移动端适配 CSS（侧栏覆盖、统计行对齐、两步设置等）。
