package com.nexus.app.features.notifications.model

import kotlinx.serialization.Serializable

internal val projectNotificationTypes = setOf(
    "PROJECT_ACTIVATED",
    "PROJECT_CANCELLATION_REQUESTED",
    "PROJECT_CANCELLATION_APPROVED",
    "PROJECT_CANCELLATION_DECLINED",
)

@Serializable data class WorkflowNotification(
    val id: String,
    val requestId: String? = null,
    val summary: String,
    val createdAt: String,
    val readAt: String? = null,
    val type: String? = null,
    val entityId: String? = null,
)

internal val WorkflowNotification.projectId: String?
    get() = entityId?.takeIf { it.isNotBlank() && type in projectNotificationTypes }

internal val WorkflowNotification.routingKey: String
    get() = projectId?.let { "project:$it" }
        ?: requestId?.takeIf { it.isNotBlank() }?.let { "request:$it" }
        ?: "notification:$id"

@Serializable data class NotificationFeed(val notifications: List<WorkflowNotification> = emptyList(), val unreadCount: Int = 0)
