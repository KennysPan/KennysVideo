# 1.1.19 统一发行版验证（2026-10-26）

发布页面：
- https://github.com/KennysPan/KennysVideo/releases/tag/v1.1.19
- https://gitee.com/kennysPan/kennys-video/releases/tag/v1.1.19

同一发行版包含 Windows 安装器、免安装程序、Android APK、完整源码、两端更新元数据与 SHA256SUMS。Windows 文件版本及产品版本均为 1.1.19，CompanyName 为 KennysPan。Android 包名不变，版本 1.1.19、versionCode 1001019，APK v2 调试签名通过。

验证结果：
- Android 浏览器交互、桌面三种窗口尺寸全屏和启动提示回归检查通过。
- 实际模拟器 APK / WebView：本地 HLS 解码播放、完整横屏视口、视频中心、左右对称控制条、返回操作、原生配置导出取消通过；首页及观看提示存在“请勿宣传本软件”。模拟缺口左安全区 48 CSS 像素，控制条左右边距分别约 68 与 67.71 像素。
- 实际 Android 更新命令识别 current/latest 1.1.19，available=false，并在 GitHub 未及时返回时自动选择 Gitee，接受正确 APK SHA-256。
- Windows 原生更新单元测试 6 项通过；2 项真实在线测试均通过，选择 GitHub 1.1.19 并完整下载、校验 3,944,891 字节安装器；未执行安装。
- Gitee 最新 API 返回稳定版 v1.1.19，两端安装包和独立哈希标记均存在；国内 APK 免登录、不使用 HTTP 代理完整下载，SHA-256 匹配。
- 源码附件白名单检查通过（246 个文件），不包含私密部署目录、签名私钥或构建缓存。

校验值：
- Windows 安装器：80849f0722bfee6459e479e30f1dd143bc1e1d7d9dd56f46273af5fec19cfeac
- Windows 免安装版：f3565f861e1c0475ab1ffb386ff7924dc28c4001fc1464d811c07779f37f4edd
- Android：3bf31c298311ee02978789030d9300d6abbb7752d3236c1276f52f0935645359
- 源码：cffba5b559db9c2432cd4f0a8bf7a0adf750a086ea339a5acc3c3313f7b48428

旧 Android 1.1.18 的 android-latest 更新入口已保留兼容 1.1.19。Gitee 原 1.1.18 测试发布改名为 android-v1.1.18，附件保留；GitHub 旧更新 JSON 改名归档，未删除。之后对外发布使用统一版本公告。

未将模拟器结果称作厂商真机验收；未执行真实 Windows 安装或 Android 系统确认安装。本次未发送真实 BUG 邮件。
