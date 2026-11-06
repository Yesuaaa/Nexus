package com.nexus.app

import android.content.ClipData
import android.content.Intent
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import com.nexus.app.core.files.*
import kotlinx.coroutines.*
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Composable
fun rememberAndroidFiles(): PlatformFiles {
    val context = LocalContext.current
    var pick by remember { mutableStateOf<CancellableContinuation<android.net.Uri?>?>(null) }
    var save by remember { mutableStateOf<CancellableContinuation<android.net.Uri?>?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        pick?.takeIf { it.isActive }?.resume(uri); pick = null
    }
    val saver = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        save?.takeIf { it.isActive }?.resume(uri); save = null
    }
    DisposableEffect(Unit) { onDispose { pick?.cancel(); save?.cancel() } }
    return remember(context, picker, saver) {
        object : PlatformFiles {
            override suspend fun select(): SelectedFile? {
                val uri = suspendCancellableCoroutine<android.net.Uri?> { continuation ->
                    check(pick == null) { "A file picker is already open" }
                    pick = continuation
                    picker.launch(supportedFileTypes.keys.toTypedArray())
                } ?: return null
                return withContext(Dispatchers.IO) {
                    var name = "attachment"
                    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use {
                        if (it.moveToFirst()) {
                            name = it.getString(0)
                            if (!it.isNull(1)) require(it.getLong(1) <= 5 * 1024 * 1024) { "File exceeds 5 MB" }
                        }
                    }
                    val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
                    val bytes = context.contentResolver.openInputStream(uri)?.use { stream ->
                        val out = java.io.ByteArrayOutputStream()
                        val buffer = ByteArray(8192)
                        while (true) {
                            val count = stream.read(buffer)
                            if (count < 0) break
                            require(out.size() + count <= 5 * 1024 * 1024) { "File exceeds 5 MB" }
                            out.write(buffer, 0, count)
                        }
                        out.toByteArray()
                    } ?: error("Unable to read selected file")
                    SelectedFile(name, mime, bytes).also(::validateFile)
                }
            }
            override suspend fun save(file: SelectedFile) {
                val uri = suspendCancellableCoroutine<android.net.Uri?> { continuation ->
                    check(save == null) { "A save dialog is already open" }
                    save = continuation; saver.launch(file.name)
                } ?: return
                withContext(Dispatchers.IO) { context.contentResolver.openOutputStream(uri)?.use { it.write(file.bytes) } ?: error("Unable to save file") }
            }
            override suspend fun preview(file: SelectedFile) {
                validateFile(file)
                val target = withContext(Dispatchers.IO) {
                    val directory = File(context.cacheDir, "workflow-previews").apply { mkdirs() }
                    File(directory, file.name).apply { writeBytes(file.bytes) }
                }
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.workflow-files", target)
                context.startActivity(Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, file.mimeType)
                    clipData = ClipData.newRawUri("Attachment", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                })
            }
        }
    }
}
