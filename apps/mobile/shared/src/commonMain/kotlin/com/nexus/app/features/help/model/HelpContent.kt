package com.nexus.app.features.help.model

import com.nexus.app.features.booking.model.statusLabel

data class FaqQuestion(
    val title: String,
    val answers: List<String>,
    val statuses: List<String> = emptyList(),
) {
    val isOrderedSteps: Boolean
        get() = statuses.isEmpty() && answers.size > 1
}

data class FaqGroup(
    val title: String,
    val questions: List<FaqQuestion>,
)

val helpFaqGroups: List<FaqGroup> = listOf(
    FaqGroup(
        title = "Bookings and requests",
        questions = listOf(
            FaqQuestion(
                title = "How do I book a service?",
                answers = listOf(
                    "Choose a service or package from the Services page.",
                    "Complete the request form with your requirements.",
                    "Review your details and submit your request.",
                ),
            ),
            FaqQuestion(
                title = "What happens after I book a service?",
                answers = listOf(
                    "The department responsible for your service will review your request. You can track its status in Booked Requests and continue the conversation once the team accepts your request.",
                ),
            ),
            FaqQuestion(
                title = "What does my request status mean?",
                answers = listOf(
                    "Your request has been received and is awaiting review.",
                    "The department is reviewing your request.",
                ),
                statuses = listOf("SUBMITTED", "UNDER_REVIEW"),
            ),
        ),
    ),
    FaqGroup(
        title = "Quotations and consultations",
        questions = listOf(
            FaqQuestion(
                title = "Where do I review my quotation?",
                answers = listOf(
                    "Your quotation will appear in the booking conversation in Messages once the team sends it.",
                ),
            ),
            FaqQuestion(
                title = "Where do I find my consultation details?",
                answers = listOf(
                    "Your booking conversation shows the date, time, and meeting link or location once your consultation is scheduled.",
                ),
            ),
            FaqQuestion(
                title = "How do I request a different time?",
                answers = listOf(
                    "Select Request reschedule on the meeting card in your booking conversation. Your original appointment remains in place until the team confirms a new time.",
                ),
            ),
        ),
    ),
)

fun filterFaqGroups(
    query: String,
    groups: List<FaqGroup> = helpFaqGroups,
): List<FaqGroup> {
    val normalized = query.trim().lowercase()
    if (normalized.isEmpty()) return groups
    return groups
        .map { group ->
            group.copy(
                questions = group.questions.filter { question ->
                    val searchable = buildList {
                        add(question.title)
                        addAll(question.answers)
                        addAll(question.statuses.map { statusLabel(it) })
                    }.joinToString(" ").lowercase()
                    searchable.contains(normalized)
                },
            )
        }
        .filter { it.questions.isNotEmpty() }
}
