package com.nexus.app.features.notifications.model

import kotlinx.serialization.Serializable

@Serializable data class WorkflowNotification(val id: String, val requestId: String, val summary: String,
    val createdAt: String, val readAt: String? = null)
@Serializable data class NotificationFeed(val notifications: List<WorkflowNotification> = emptyList(), val unreadCount: Int = 0)
