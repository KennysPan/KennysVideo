# KennysVideo 更新发布

GitHub：https://github.com/KennysPan/KennysVideo
Gitee：https://gitee.com/kennysPan/kennys-video

## 1.1.7 起的检查和下载策略

- 每次进程启动后台检查一次，设置中可手动重试。
- 优先请求 GitHub 最新 release 的 update.json（包括重定向和响应正文共 3 秒），超时、网络错误、无效 JSON、未就绪安装包、404 等情况自动请求 Gitee latest release API（12 秒）。GitHub 返回合法版本后不重复请求 Gitee。
- 用户点击“下载更新”后在程序内下载；检查已回退 Gitee 时，下载直接使用 Gitee。
- GitHub 下载在连接/响应头超过 3 秒、读取连续停顿超过 3 秒，或下载持续至少 5 秒且平均速度低于 64 KiB/s 时自动切换 Gitee。同版本下载从头重新开始，避免拼接两个来源的文件。
- Gitee 连接和读取停顿各允许 12 秒；每次单来源下载最长 180 秒，安装包最大 100 MiB。两来源均失败时允许重试和手动下载，不阻止软件使用。
- 只接受固定仓库、合法数字版本和对应安装包路径；不从前端接收任意执行路径。下载后以及执行前均验证 SHA256。只有用户再点击“关闭程序并安装”才启动已验证的安装器并退出当前程序。
- 手动下载打开检查或成功下载所选来源的发布页；浏览器手动下载不受程序内自动测速控制。
- 请求不使用代理环境变量、Cookie 或 Token，不上传设置和观看历史。

## 发布约定

1. 同步应用版本：package.json、package-lock.json、Cargo.toml、Cargo.lock（仅 app 包）、tauri.conf.json、public/js/config.js。
2. 构建 NSIS，复制到 dist-windows/KennysVideo-版本-x64-setup.exe，并提供免安装版。
3. 运行 `python tests/prepareRelease.py`，生成 update.json 和发布说明。GitHub update.json 使用 installer_sha256 字段；Gitee 发布说明必须包含独立一行 `KennysVideo-SHA256: 64位十六进制摘要`。两来源使用同一个安装包。
4. 运行 `python tests/packageSource.py`，提供修改版源码、LICENSE、NOTICE 和构建说明。
5. 两边均以正式标签 v主版本.次版本.修订号 发布安装包和源码并标为最新版。GitHub 附带 update.json；Gitee 使用公开 API 提供版本信息。保持两边同步。

旧版需先安装 1.1.7 才具备下载自动换源能力。缺少校验摘要的旧发行版可查看版本和手动下载，禁止在程序内执行未校验安装包。

## 验证范围

Rust 本地 HTTP 测试通过真实 reqwest 覆盖 GitHub 快速成功（不访问 Gitee）、错误/404/无效 JSON、响应头慢、正文慢的换源；安装包下载覆盖连接慢、卡住、持续低速、摘要错误回退，以及 Gitee 失败和正常 GitHub 下载。浏览器测试使用 IPC 适配器检查提示、手动下载、下载后不自动安装、下载失败和安装启动错误。

Postman CLI 未安装，上述测试不称为 Postman simulation。live_source_selection 为单独执行的真实联网测试；测试不会运行安装器或覆盖本机安装。

接口参考：https://gitee.com/api/v5/swagger 、 https://docs.github.com/en/rest/releases/releases#get-the-latest-release
