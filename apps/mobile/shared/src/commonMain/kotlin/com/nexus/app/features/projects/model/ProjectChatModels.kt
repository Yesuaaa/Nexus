package com.nexus.app.features.projects.model

import com.nexus.app.features.conversations.model.Person
import kotlinx.serialization.Serializable

@Serializable data class ProjectChatAttachment(val id: String, val title: String, val fileName: String)
@Serializable data class ProjectChatMessage(
    val id: String, val body: String? = null, val clientMessageId: String? = null,
    val createdAt: String, val sender: Person, val deliverable: ProjectChatAttachment? = null,
)
@Serializable data class ProjectChatHistory(
    val messages: List<ProjectChatMessage> = emptyList(), val nextCursor: String? = null,
    val canSend: Boolean = false, val archived: Boolean = false,
)
@Serializable data class ProjectMessageResponse(val message: ProjectChatMessage)
