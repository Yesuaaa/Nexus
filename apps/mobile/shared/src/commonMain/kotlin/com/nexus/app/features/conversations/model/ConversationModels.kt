package com.nexus.app.features.conversations.model

import kotlinx.serialization.Serializable

@Serializable data class Person(val id: String = "", val fullName: String = "", val imageUrl: String? = null, val specialistId: String? = null)
@Serializable data class Department(val name: String = "", val head: Person? = null)
@Serializable data class ServiceName(val name: String = "")
@Serializable data class ChatMessage(
    val id: String, val body: String? = null, val clientMessageId: String? = null,
    val createdAt: String = "", val editedAt: String? = null, val deletedAt: String? = null,
    val sender: Person = Person()
)
@Serializable data class ConversationBooking(val id: String, val title: String = "", val serviceName: String = "", val status: String = "", val referenceNumber: String? = null, val workflowState: String = "PENDING_REVIEW")
@Serializable data class ConversationRow(
    val id: String, val title: String = "", val status: String = "",
    val service: ServiceName = ServiceName(), val acceptedDepartment: Department? = null,
    val lastMessage: ChatMessage? = null, val unreadCount: Int = 0, val bookings: List<ConversationBooking> = emptyList()
)
@Serializable data class ConversationPage(val conversations: List<ConversationRow> = emptyList(), val nextCursor: String? = null, val unreadCount: Int = 0)
@Serializable data class ConversationInfo(val head: Person? = null, val department: Department? = null, val bookings: List<ConversationBooking> = emptyList())
@Serializable data class History(val messages: List<ChatMessage> = emptyList(), val nextCursor: String? = null,
    val selectedBookingId: String? = null, val archived: Boolean = true, val canSend: Boolean = false, val conversation: ConversationInfo? = null)
@Serializable data class SendMessage(val body: String, val clientMessageId: String)
@Serializable data class MessageResponse(val message: ChatMessage)
data class PendingMessage(val clientMessageId: String, val body: String, val failed: Boolean = false, val failureReason: String? = null)

/** Server identities replace optimistic entries even after an ambiguous send timeout. */
fun mergeMessages(existing: List<ChatMessage>, incoming: List<ChatMessage>): List<ChatMessage> =
    (existing.associateBy { it.id } + incoming.associateBy { it.id }).values
        .sortedWith(compareBy<ChatMessage> { it.createdAt }.thenBy { it.id })
fun reconcilePending(pending: List<PendingMessage>, messages: List<ChatMessage>): List<PendingMessage> {
    val confirmed = messages.mapNotNull { it.clientMessageId }.toSet()
    return pending.filterNot { it.clientMessageId in confirmed }
}
