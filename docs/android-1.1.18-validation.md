# Android 1.1.18 发布验证

日期：2026-10-26。GitHub 独立测试发布：<https://github.com/KennysPan/KennysVideo/releases/tag/android-latest>。

- 安装包：KennysVideo-1.1.18-android.apk，47,441,244 字节。
- SHA-256：63b914ebd4dd7816f09d1324a5b7b0ecf51bdda863e5043cf52f19cc287a2470。
- 包名 com.libretv.app，versionCode 1001018，versionName 1.1.18；最低 API 24，目标 API 35；APK v2 调试签名通过。
- 手机界面测试通过启动检查、下载进度、安装按钮及权限失败重试的交互测试；原生命令使用替身，仅证明前端行为。
- Android 模拟器安装实际 APK，通过原生 HTTP、本地 HLS 解码播放、水滴屏完整横屏视口、控制条缺口避让、返回层级及原生导出取消。未发送真实 BUG 邮件。
- 已安装 APK 的真实 `check_app_update` 命令读取 GitHub 公开清单，返回 current/latest 均为 1.1.18、available=false、source=github，以及正确的 APK SHA-256。
- 免登录、无 HTTP 代理下载 GitHub 已发布完整 APK，文件 SHA-256 与本地及清单一致。
- Windows 更新单元测试 6 项通过；2 项外网测试忽略。已有本地 HTTP 测试覆盖超时、低速、无总大小、错误内容和错误哈希。
- 源码附件白名单检查通过（243 个文件），不包含 server-private、签名私钥、本地配置或构建缓存。

此记录不表示已完成真实手机系统安装确认或下一版本升级的全链路验收。APK 当前为调试签名测试版；Android 1.1.17 预览版未接入更新器，需手动安装一次。Gitee Android 通道暂未发布，不能声称备用源已实测可用。Windows latest 发布保持原通道。
