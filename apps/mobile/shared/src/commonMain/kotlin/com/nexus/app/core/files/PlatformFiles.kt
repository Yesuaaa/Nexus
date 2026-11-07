package com.nexus.app.core.files

import androidx.compose.runtime.staticCompositionLocalOf

data class SelectedFile(val name: String, val mimeType: String, val bytes: ByteArray)
interface PlatformFiles {
    suspend fun select(): SelectedFile?
    suspend fun selectImage(): SelectedFile? = select()
    suspend fun save(file: SelectedFile)
    suspend fun preview(file: SelectedFile)
}
val LocalPlatformFiles = staticCompositionLocalOf<PlatformFiles?> { null }
val supportedFileTypes = mapOf("application/pdf" to listOf("pdf"), "image/png" to listOf("png"),
    "image/jpeg" to listOf("jpg", "jpeg"), "text/plain" to listOf("txt"), "application/msword" to listOf("doc"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" to listOf("docx"))
fun validateFile(file: SelectedFile) {
    require(file.bytes.isNotEmpty() && file.bytes.size <= 5 * 1024 * 1024) { "Select a file between 1 byte and 5 MB." }
    require(file.name.length in 1..160 && !file.name.startsWith('.') && file.name.none { it.code < 32 || it in "<>:\"/\\|?*" }) { "Use a plain file name." }
    require(file.name.substringAfterLast('.', "").lowercase() in (supportedFileTypes[file.mimeType] ?: emptyList())) { "Supported files: PDF, Word, PNG, JPEG and text. File type must match its extension." }
}
