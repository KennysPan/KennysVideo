# Windows 交互修复（1.1.8）

影片点击无响应的复现：原首页将原生下载的海报 data URI 一起序列化到 sessionStorage.homePageState。数据超出存储配额时，navigateToTab 的保存步骤抛出 QuotaExceededError，导致跳转和搜索中断。现在保存前以可重新加载的默认图替换 data URI；保存失败也不会阻止导航。

卡片以 data-movie-title 保存原始片名，通过统一事件委托处理鼠标及 Enter/空格，避免带引号的片名拼接 inline JavaScript 时产生语法错误。委托在页面 HTML 恢复后仍有效；滚动按钮恢复时重新绑定。保留用户已选数据源。

Windows 使用官方 tauri-plugin-single-instance 2.2.4（兼容现有 Tauri 2.5），基于稳定应用标识 com.libretv.app 限制实例。重复启动执行 show → unminimize → set_focus，不创建新 WebView，也不重新导航或中断播放。升级后需关闭旧版再运行新版，旧版进程自身不具备单实例机制。

全局 user-select: none；input、textarea、可编辑区域保留 user-select: text。CSS 同步到源样式，重新构建时可保留规则。

验证：node tests/movieClick.cjs 覆盖 6 MiB 海报数据缓存、缓存失败、普通/带引号片名、恢复后的卡片、键盘点击、禁止选中普通文字和输入框可编辑。tests/singleInstance.ps1 启动独立 WebView2 测试配置，重复启动三次并验证子实例退出、主窗口仍存在，仅关闭自己启动的进程。
