package com.nexus.app.features.conversations.components

import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.nexus.app.core.files.LocalPlatformFiles
import com.nexus.app.core.files.SelectedFile
import com.nexus.app.features.conversations.model.ConversationAttachment
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun ConversationAttachmentCard(
    attachment: ConversationAttachment,
    own: Boolean,
    load: suspend () -> SelectedFile,
) {
    val file = attachment.file
    val platform = LocalPlatformFiles.current
    val scope = rememberCoroutineScope()
    var image by remember(attachment.requestId, file.id) { mutableStateOf<SelectedFile?>(null) }
    var error by remember(attachment.requestId, file.id) { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var retry by remember { mutableIntStateOf(0) }
    val isImage = file.mimeType in listOf("image/jpeg", "image/png")
    LaunchedEffect(attachment.requestId, file.id, retry) {
        if (isImage) {
            error = null
            try { image = load() }
            catch (e: CancellationException) { throw e }
            catch (_: Exception) { error = "Couldn't load image preview." }
        }
    }
    fun download() {
        if (busy || platform == null) return
        busy = true
        scope.launch {
            try {
                val content = image ?: load()
                platform.save(content)
                error = null
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { error = "Couldn't download this file. Please try again." }
            finally { busy = false }
        }
    }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (own) Alignment.End else Alignment.Start) {
        Column(Modifier.widthIn(max = 300.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(attachment.serviceName, fontSize = 11.sp, color = ConversationStyle.Muted)
            if (isImage) {
                image?.let { content ->
                    AsyncImage(model = content.bytes, contentDescription = "Preview of ${file.name}",
                        onError = { image = null; error = "Couldn't display image preview." },
                        contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp, max = 260.dp))
                } ?: if (error == null) {
                    LinearProgressIndicator(Modifier.fillMaxWidth())
                } else Unit
            }
            FileAttachmentCard(file, ::download)
            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                if (isImage) TextButton(shape = NexusButtonShape, onClick = { retry++ }) { Text("Retry preview") }
            }
        }
    }
}
