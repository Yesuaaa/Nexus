package com.nexus.app.features.projects.model

import kotlinx.datetime.*
import kotlinx.serialization.Serializable

@Serializable data class ProjectService(val name: String)
@Serializable data class ProjectBooking(val id: String, val referenceNumber: String? = null, val service: ProjectService)
@Serializable data class ClientProjectSummary(
    val id: String, val name: String, val description: String? = null, val status: String,
    val startDate: String? = null, val updatedAt: String, val request: ProjectBooking? = null,
    val completedTasks: Int = 0, val taskCount: Int = 0, val deliverableCount: Int = 0,
)
@Serializable data class ProjectProgress(val completed: Int = 0, val total: Int = 0)
@Serializable data class ProjectFile(val id: String, val name: String, val mimeType: String, val size: Int)
@Serializable data class DeliverableReview(val status: String, val note: String? = null, val workflowFileId: String? = null)
@Serializable data class ClientDeliverable(
    val id: String, val title: String, val description: String? = null,
    val sentToClientAt: String? = null, val workflowFile: ProjectFile,
    val clientReviews: List<DeliverableReview> = emptyList(),
)
@Serializable data class ProjectChange(
    val id: String, val kind: String, val details: String, val status: String,
    val responseNote: String? = null, val createdAt: String,
)
@Serializable data class ClientProject(
    val id: String, val name: String, val description: String? = null, val status: String,
    val startDate: String? = null, val createdAt: String, val request: ProjectBooking? = null,
    val progress: ProjectProgress = ProjectProgress(), val deliverables: List<ClientDeliverable> = emptyList(),
    val changeRequests: List<ProjectChange> = emptyList(),
) {
    val cancellationPending get() = changeRequests.any { it.kind == "CANCELLATION" && it.status == "PENDING" }
    val editable get() = status in setOf("IN_PROGRESS", "ON_HOLD") && !cancellationPending
}
@Serializable data class CalendarEvent(
    val id: String, val type: String, val title: String, val context: String,
    val startsAt: String, val endsAt: String? = null, val location: String? = null,
    val staff: String? = null, val pending: Boolean = false, val completed: Boolean = false, val href: String,
)
val PhilippineTime: TimeZone = TimeZone.of("Asia/Manila")
fun calendarDate(timestamp: String): LocalDate = Instant.parse(timestamp).toLocalDateTime(PhilippineTime).date
fun calendarTime(timestamp: String): String {
    val time = Instant.parse(timestamp).toLocalDateTime(PhilippineTime).time
    val hour = time.hour % 12
    return "${if (hour == 0) 12 else hour}:${time.minute.toString().padStart(2, '0')} ${if (time.hour < 12) "AM" else "PM"}"
}
fun displayDate(timestamp: String?): String = timestamp?.let {
    runCatching { calendarDate(it).let { date -> "${date.monthNumber}/${date.dayOfMonth}/${date.year}" } }.getOrDefault("—")
} ?: "—"
fun statusLabel(status: String): String = status.lowercase().replace('_', ' ').replaceFirstChar { it.uppercase() }
fun progressFraction(completed: Int, total: Int): Float = if (total > 0) (completed.toFloat() / total).coerceIn(0f, 1f) else 0f
