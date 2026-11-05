# 用户提供的品牌图片

原图保存在 public/image/kennys-logo.jpg，保持原有白底及人物完整，不做重绘或裁切。
播放器默认背景和影片缺失/失败封面采用横向品牌组合：小头像位于左侧，KennysVideo 及标语/说明位于右侧。

生成流程：node tests/prepareBrandAssets.cjs；npm run tauri -- icon public/image/kennys-logo.svg --output src-tauri/icons；node tests/installBrandIcons.cjs。第一个命令也可传入新原图的绝对路径。

Tauri 官方图标生成器将原图包装 SVG 转换为各平台所需尺寸/格式。Windows ICO 包含多尺寸图像，应用资源、标题栏/任务栏、快捷方式和系统托盘共用构建图标；NSIS 安装器显式指定该 ICO。安装完成通过 SHChangeNotify 通知 Shell 刷新图标，不删除用户图标缓存文件。

首页和播放器使用原 JPG，所有页面 favicon、SITE_CONFIG.logo 和 PWA manifest 使用转换后的 PNG。兼容旧 retrotv_5520.png 路径也已替换。默认播放器 nomedia.svg 与缺失封面 poster-placeholder.svg 内嵌同一张原 JPG，可完全离线显示；影片真实海报的成功/失败加载流程保持原样。
