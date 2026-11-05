# KennysVideo 1.1.17

## 下载进度界面

- 更新进度条采用深色圆角轨道与青蓝至青绿色渐变，替换 Windows 默认绿色进度和灰色底条。
- 调整版本号、来源、百分比与文件大小的排版，百分比和大小使用等宽数字。
- 未知文件大小时显示等待动画，并遵循系统的减少动画偏好。保留换源重置、失败重试和校验成功后才显示 100% 的行为。

## 文字选择与开发者信息

- 常规页面及关闭弹窗的说明、标题和按钮文字均禁止选中；搜索、反馈和配置等编辑区域继续支持输入、选中和复制。
- 可执行文件和安装器的文件属性、安装记录中增加开发者 KennysPan，完善 Rust 项目的作者与仓库信息。保持原有应用和安装标识以支持覆盖升级。
- 开发者名称属于文件元数据，本版本尚未取得受信任的 Windows 代码签名。添加名称不等同于认证发布者，也不能保证 Windows 智能应用控制放行。说明见 windows-signing.md。

## 安装与来源

提供 Windows x64 安装版、免安装版与完整源码；保留 GitHub 优先、超时或低速回退 Gitee 及安装包 SHA256 校验。

基于 [KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App) 修改，上游为 [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV)。保留 Apache License 2.0、版权声明、NOTICE 与第三方许可。
