"""Generate matching release metadata and SHA256 marker for both update sources."""
from pathlib import Path
import hashlib, json
root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
output = root / 'dist-windows'
name = f'KennysVideo-{version}-x64-setup.exe'
checksum = hashlib.sha256((output / name).read_bytes()).hexdigest()
manifest = dict(tag_name=f'v{version}', draft=False, prerelease=False, installer_sha256=checksum,
                assets=[dict(name=name, state='uploaded', browser_download_url=f'https://github.com/KennysPan/KennysVideo/releases/download/v{version}/{name}')])
(output / 'update.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
notes = f'''# KennysVideo {version}

默认影片封面改为左侧小头像、右侧 KennysVideo 文字与说明，覆盖首页、搜索和分类中缺失/加载失败的封面；与播放器默认背景保持横向品牌布局。真实影片海报仍在成功加载后替换默认图。

新增更新下载进度条：显示真实已下载大小、总大小、百分比及当前来源。GitHub 回退 Gitee 时显示切换并从零计数；总大小未知时显示不定进度。校验并保存成功后才到 100%，失败可重试，安装仍由用户确认。
下载开始后精简弹窗，只保留版本变化及进度区域；隐藏原下载说明，出错时显示可重试提示。
修复桌面/任务栏旧图标：安装器保存版本化 ICO，并刷新指向本程序的现有快捷方式。播放器默认背景恢复小图居左、文字居右；主页面下滑后提供返回顶部浮动按钮。

品牌图标更新：统一使用用户提供的图片作为首页与播放器 LOGO、网页图标、桌面快捷方式、程序/任务栏、系统托盘及安装器图标。播放器默认背景、缺失/加载失败的影片封面占位图同步替换；实际影片海报保持正常加载。安装完成会通知 Windows 刷新快捷方式图标。

新增：关闭时选择“最小化到系统托盘”将隐藏主窗口及任务栏按钮。点击或双击托盘图标恢复，右键可显示主窗口或退出程序。保留不再提示、设置修改和单窗口恢复。
每次弹出关闭确认都默认选择最小化到系统托盘，不沿用上次未记住的退出选择。
修复：设置页容器标签错位导致各区域宽度不同；统一六个区域的宽度、内边距、间距、文字及控件尺寸。

关闭窗口时可选择“最小化到系统托盘”或“退出程序”，带“下次不再提示”复选框，以及确定和取消按钮。取消/Esc 不保存也不执行操作；设置 → 关闭按钮行为 可随时修改记住的选择。偏好随覆盖升级保留。

修复：影片海报数据导致首页缓存超出配额、打断搜索跳转；缓存不再保存大体积图片数据，保存失败也不影响导航。卡片点击支持特殊片名、键盘操作和页面缓存恢复，并使用当前选择的数据源。
优化：Windows 单实例运行，重复启动会唤起已有窗口并恢复最小化状态；普通界面文字不可选中，搜索框和配置输入仍可正常选中编辑。

优先 GitHub 检查版本，3 秒内未完成或失败时自动切换 Gitee。
程序内下载安装包时，GitHub 连接超过 3 秒、读取停顿超过 3 秒，或下载已持续 5 秒且平均速度低于 64 KiB/s 时，自动从 Gitee 重新下载同一版本。
安装包经过 SHA256 校验；完成后由用户点击“关闭程序并安装”，覆盖升级并保留设置和历史。
首次使用此策略请安装 {version}。检查失败不影响使用，也保留手动下载入口。

国内下载：https://gitee.com/kennysPan/kennys-video/releases/latest
GitHub 备份：https://github.com/KennysPan/KennysVideo/releases/latest

开源来源：基于 KeyRotate/LibreTV-App（https://github.com/KeyRotate/LibreTV-App）修改，上游为 LibreSpark/LibreTV（https://github.com/LibreSpark/LibreTV）。感谢原作者及贡献者。修改版由 KennysPan 维护，保留 Apache License 2.0、版权声明和第三方许可。
完整修改版源码、LICENSE、NOTICE 和构建说明在带版本号的 source.zip 中；平台自动生成的 Source code 包只包含发布仓库文档。

KennysVideo-SHA256: {checksum}
'''
version_notes = root / 'docs' / f'release-{version}.md'
if version_notes.exists():
    notes = version_notes.read_text(encoding='utf-8').rstrip() + f'\n\nKennysVideo-SHA256: {checksum}\n'
(output / f'KennysVideo-{version}-release-notes.md').write_text(notes, encoding='utf-8')
print(checksum)
