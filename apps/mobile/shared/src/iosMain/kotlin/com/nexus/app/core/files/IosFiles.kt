@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)
package com.nexus.app.core.files

import kotlinx.cinterop.*
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.Foundation.*
import platform.UIKit.*
import platform.darwin.NSObject
import platform.posix.memcpy
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Imported documents are copied into the app sandbox; no broad filesystem permission is requested. */
class IosFiles : PlatformFiles {
    private var delegate: UIDocumentPickerDelegateProtocol? = null
    private fun presenter(): UIViewController {
        var controller = UIApplication.sharedApplication.keyWindow?.rootViewController ?: error("No active window")
        while (controller.presentedViewController != null) controller = controller.presentedViewController!!
        return controller
    }
    override suspend fun select(): SelectedFile? = suspendCancellableCoroutine { continuation ->
        val picker = UIDocumentPickerViewController(documentTypes = listOf("com.adobe.pdf", "public.png", "public.jpeg", "public.plain-text", "com.microsoft.word.doc", "org.openxmlformats.wordprocessingml.document"), inMode = UIDocumentPickerMode.UIDocumentPickerModeImport)
        val handler = object : NSObject(), UIDocumentPickerDelegateProtocol {
            override fun documentPicker(controller: UIDocumentPickerViewController, didPickDocumentsAtURLs: List<*>) {
                try {
                    val url = didPickDocumentsAtURLs.firstOrNull() as? NSURL ?: error("No file selected")
                    val attributes = NSFileManager.defaultManager.attributesOfItemAtPath(url.path!!, null)
                    val size = (attributes?.get(NSFileSize) as? NSNumber)?.longLongValue ?: 0
                    require(size in 1..5L * 1024 * 1024) { "Select a file between 1 byte and 5 MB." }
                    val data = NSData.dataWithContentsOfURL(url) ?: error("Unable to read selected file")
                    val name = url.lastPathComponent ?: "attachment"
                    val extension = name.substringAfterLast('.', "").lowercase()
                    val mime = supportedFileTypes.entries.firstOrNull { extension in it.value }?.key ?: error("Unsupported file type")
                    val bytes = ByteArray(data.length.toInt())
                    bytes.usePinned { memcpy(it.addressOf(0), data.bytes, data.length) }
                    val file = SelectedFile(name, mime, bytes).also(::validateFile)
                    if (continuation.isActive) continuation.resume(file)
                } catch (error: Exception) { if (continuation.isActive) continuation.resumeWithException(error) }
                delegate = null
            }
            override fun documentPickerWasCancelled(controller: UIDocumentPickerViewController) {
                if (continuation.isActive) continuation.resume(null)
                delegate = null
            }
        }
        delegate = handler
        picker.delegate = handler
        picker.allowsMultipleSelection = false
        presenter().presentViewController(picker, true, null)
        continuation.invokeOnCancellation { delegate = null }
    }
    private fun temporary(file: SelectedFile): NSURL {
        validateFile(file)
        val directory = NSTemporaryDirectory() + "workflow-previews/"
        NSFileManager.defaultManager.createDirectoryAtPath(directory, true, null, null)
        val path = directory + file.name
        file.bytes.usePinned { pinned ->
            val data = NSData.create(bytes = pinned.addressOf(0), length = file.bytes.size.toULong())
            check(data.writeToFile(path, true)) { "Unable to prepare file" }
        }
        return NSURL.fileURLWithPath(path)
    }
    override suspend fun save(file: SelectedFile) {
        val picker = UIDocumentPickerViewController(URLs = listOf(temporary(file)), inMode = UIDocumentPickerMode.UIDocumentPickerModeExportToService)
        presenter().presentViewController(picker, true, null)
    }
    override suspend fun preview(file: SelectedFile) {
        val controller = UIActivityViewController(activityItems = listOf(temporary(file)), applicationActivities = null)
        val parent = presenter()
        controller.popoverPresentationController?.sourceView = parent.view
        parent.presentViewController(controller, true, null)
    }
}
