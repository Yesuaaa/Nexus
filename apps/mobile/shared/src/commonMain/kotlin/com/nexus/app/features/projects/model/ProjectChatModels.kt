package com.nexus.app.features.projects.model

import com.nexus.app.features.conversations.model.PendingMessage
import com.nexus.app.features.conversations.model.Person
import kotlinx.serialization.Serializable

@Serializable
data class ProjectChatAttachment(
    val id: String,
    val title: String,
    val fileName: String,
    val fileId: String? = null,
    val kind: String? = null,
)

@Serializable
data class ProjectChatMessage(
    val id: String,
    val body: String? = null,
    val clientMessageId: String? = null,
    val createdAt: String,
    val sender: Person = Person(),
    val deliverable: ProjectChatAttachment? = null,
)

@Serializable
data class ProjectConversationHeader(
    val fullName: String? = null,
    val imageUrl: String? = null,
    val position: String? = null,
)

@Serializable
data class ProjectConversationDetails(
    val id: String,
    val name: String = "",
    val description: String? = null,
    val status: String = "",
    val startDate: String? = null,
    val workspaceId: String = "",
    val serviceName: String? = null,
    val referenceNumber: String? = null,
)

@Serializable
data class ProjectChatHistory(
    val messages: List<ProjectChatMessage> = emptyList(),
    val nextCursor: String? = null,
    val canSend: Boolean = false,
    val archived: Boolean = false,
    val conversation: ProjectConversationHeader? = null,
    val participants: List<Person> = emptyList(),
    val project: ProjectConversationDetails? = null,
)

@Serializable
data class ProjectMessageResponse(val message: ProjectChatMessage)

@Serializable
data class ProjectConversationRow(
    val id: String,
    val name: String = "",
    val archived: Boolean = false,
    val isGroup: Boolean = false,
    val participants: List<Person> = emptyList(),
    val updatedAt: String = "",
    val lastMessage: ProjectChatMessage? = null,
    val unreadCount: Int = 0,
)

@Serializable
data class ProjectConversationPage(
    val conversations: List<ProjectConversationRow> = emptyList(),
    val nextCursor: String? = null,
    val unreadCount: Int = 0,
)

fun mergeProjectMessages(
    existing: List<ProjectChatMessage>,
    incoming: List<ProjectChatMessage>,
): List<ProjectChatMessage> =
    (existing.associateBy { it.id } + incoming.associateBy { it.id }).values
        .sortedWith(compareBy<ProjectChatMessage> { it.createdAt }.thenBy { it.id })

fun reconcileProjectPending(
    pending: List<PendingMessage>,
    messages: List<ProjectChatMessage>,
): List<PendingMessage> {
    val confirmed = messages.mapNotNull { it.clientMessageId }.toSet()
    return pending.filterNot { it.clientMessageId in confirmed }
}
