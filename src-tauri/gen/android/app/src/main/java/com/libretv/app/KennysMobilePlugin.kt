package com.libretv.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.media.AudioManager
import android.content.Context
import kotlin.math.roundToInt
import androidx.core.content.FileProvider
import java.io.File
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import app.tauri.plugin.JSObject

@InvokeArg
class FullscreenArgs { var fullscreen: Boolean = false }

@InvokeArg
class ExportArgs { var content: String = ""; var filename: String = "KennysVideo-Settings.KennysVideo" }

@InvokeArg
class InstallArgs { var path: String = "" }

@InvokeArg
class PlayerControlArgs { var control: String = ""; var value: Double = 0.0 }

@TauriPlugin
class KennysMobilePlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun getPlayerControls(invoke: Invoke) {
        activity.runOnUiThread {
            try {
                val audio = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val maximum = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
                val preferred = Settings.System.getInt(activity.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128) / 255.0
                val brightness = activity.window.attributes.screenBrightness.toDouble().let { if (it < 0) preferred else it }
                val result = JSObject()
                result.put("brightness", brightness.coerceIn(0.02, 1.0))
                result.put("volume", audio.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / maximum)
                result.put("volume_fixed", audio.isVolumeFixed)
                invoke.resolve(result)
            } catch (error: Exception) { invoke.reject("Unable to read player controls", error) }
        }
    }

    @Command
    fun setPlayerControl(invoke: Invoke) {
        val args = invoke.parseArgs(PlayerControlArgs::class.java)
        activity.runOnUiThread {
            try {
                require(args.value.isFinite()) { "Invalid control value" }
                var actual = args.value.coerceIn(0.0, 1.0)
                when (args.control) {
                    "brightness" -> {
                        actual = if (args.value == -1.0) -1.0 else args.value.coerceIn(0.02, 1.0)
                        activity.window.attributes = activity.window.attributes.apply { screenBrightness = actual.toFloat() }
                    }
                    "volume" -> {
                        val audio = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                        require(!audio.isVolumeFixed) { "Fixed volume device" }
                        val maximum = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
                        audio.setStreamVolume(AudioManager.STREAM_MUSIC, (actual * maximum).roundToInt(), 0)
                        actual = audio.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / maximum
                    }
                    else -> throw IllegalArgumentException("Unknown player control")
                }
                val result = JSObject(); result.put("value", actual); invoke.resolve(result)
            } catch (error: Exception) { invoke.reject("Unable to change player control", error) }
        }
    }

    @Command
    fun openUpdatePage(invoke: Invoke) {
        activity.runOnUiThread {
            try {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/KennysPan/KennysVideo/releases/latest")))
                invoke.resolve()
            } catch (error: Exception) { invoke.reject("Unable to open update page", error) }
        }
    }

    @Command
    fun installUpdate(invoke: Invoke) {
        val args = invoke.parseArgs(InstallArgs::class.java)
        activity.runOnUiThread {
            try {
                val apk = File(args.path).canonicalFile
                val directory = File(activity.cacheDir, "updates").canonicalFile
                require(apk.parentFile == directory && apk.isFile && apk.extension == "apk") { "Invalid update file" }
                val info = activity.packageManager.getPackageArchiveInfo(apk.path, 0)
                    ?: throw IllegalArgumentException("Invalid APK")
                require(info.packageName == activity.packageName) { "Update package does not match this app" }
                val installed = activity.packageManager.getPackageInfo(activity.packageName, 0)
                val nextVersion = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
                val currentVersion = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
                require(nextVersion > currentVersion) { "Update must have a newer version" }
                if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
                    activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
                    invoke.reject("请允许 KennysVideo 安装更新，返回后再次点击安装"); return@runOnUiThread
                }
                val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", apk)
                activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                })
                invoke.resolve()
            } catch (error: Exception) { invoke.reject("Unable to start Android update installer", error) }
        }
    }

    @Command
    fun exportConfig(invoke: Invoke) {
        val args = invoke.parseArgs(ExportArgs::class.java)
        if (args.content.toByteArray(Charsets.UTF_8).size > 10 * 1024 * 1024 || !args.filename.matches(Regex("[A-Za-z0-9._-]{1,120}\\.(KennysVideo|json)", RegexOption.IGNORE_CASE))) {
            invoke.reject("Invalid configuration file"); return
        }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (args.filename.endsWith(".json", ignoreCase = true)) "application/json" else "application/octet-stream"
            putExtra(Intent.EXTRA_TITLE, args.filename)
        }
        startActivityForResult(invoke, intent, "saveConfig")
    }

    @ActivityCallback
    private fun saveConfig(invoke: Invoke, result: ActivityResult) {
        val data = JSObject()
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { data.put("saved", false); invoke.resolve(data); return }
        try {
            val args = invoke.parseArgs(ExportArgs::class.java)
            val output = activity.contentResolver.openOutputStream(uri, "wt") ?: throw IllegalStateException("No output stream")
            output.use { it.write(args.content.toByteArray(Charsets.UTF_8)) }
            data.put("saved", true); invoke.resolve(data)
        } catch (error: Exception) { invoke.reject("Unable to save configuration", error) }
    }

    @Command
    fun setFullscreen(invoke: Invoke) {
        val args = invoke.parseArgs(FullscreenArgs::class.java)
        activity.runOnUiThread {
            try {
                (activity as MainActivity).setPlayerFullscreen(args.fullscreen)
                invoke.resolve()
            } catch (error: Exception) { invoke.reject("Unable to change fullscreen", error) }
        }
    }
}
