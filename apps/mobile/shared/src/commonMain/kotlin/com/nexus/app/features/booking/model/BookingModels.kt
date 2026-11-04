package com.nexus.app.features.booking.model

import kotlinx.serialization.Serializable
import kotlin.uuid.Uuid

@OptIn(kotlin.uuid.ExperimentalUuidApi::class)
fun newSubmissionKey(): String = Uuid.random().toString()

@Serializable
data class Pricing(
    val pricingModel: String = "CUSTOM_QUOTE", val currency: String = "PHP",
    val amount: String? = null, val billingInterval: String? = null,
    val isPublic: Boolean = false
) {
    fun label(): String = priceLabel(pricingModel, if (isPublic) amount else null, currency, billingInterval)
}

fun priceLabel(model: String?, amount: String?, currency: String?, interval: String?): String {
    if (amount == null || model == null || model == "CUSTOM_QUOTE") return "Contact for pricing"
    val prefix = if (model == "STARTING") "From " else ""
    val suffix = when {
        model == "HOURLY" -> " / hour"
        model == "RECURRING" && interval != null -> " / " + interval.lowercase()
        else -> ""
    }
    return "$prefix${currency ?: "PHP"} $amount$suffix"
}

typealias ServicePackage = com.nexus.app.features.services.model.ServicePackageDto

@Serializable
data class ServiceBenefit(val id: String, val title: String, val description: String = "")
@Serializable
data class ServiceDepartment(val id: String, val name: String)
typealias CatalogService = com.nexus.app.features.services.model.ServiceDto

typealias Specialist = com.nexus.app.features.services.model.SpecialistDto

@Serializable
data class SpecialistProfile(
    val id: String, val fullName: String, val position: String? = null,
    val imageUrl: String? = null, val bio: String? = null,
    val specialties: List<String> = emptyList()
)
typealias RequestReceipt = com.nexus.app.features.services.model.BookingReceiptDto

@Serializable
data class BookingDraft(
    val serviceId: String = "", val packageId: String? = null,
    val preferredSpecialistId: String? = null,
    val submissionKey: String = newSubmissionKey(),
    val goals: String = "", val requirements: String = "",
    val expectedTimeline: String = "", val additionalDetails: String = ""
) {
    fun errors(): Map<String, String> = buildMap {
        listOf(Triple("goals", goals, 2000), Triple("requirements", requirements, 5000),
            Triple("expectedTimeline", expectedTimeline, 300),
            Triple("additionalDetails", additionalDetails, 5000)).forEach { (key, value, limit) ->
            if (key != "additionalDetails" && value.isBlank()) put(key, "This field is required.")
            else if (value.trim().length > limit) put(key, "Use $limit characters or fewer.")
        }
    }
    fun normalized() = copy(goals = goals.trim(), requirements = requirements.trim(),
        expectedTimeline = expectedTimeline.trim(), additionalDetails = additionalDetails.trim())
}
@Serializable
data class RequestService(val id: String, val name: String)
typealias RequestRecord = com.nexus.app.features.booked_requests.model.BookedRequestDto

typealias RequestSummary = com.nexus.app.features.booked_requests.model.RequestKpisDto

typealias RequestsPage = com.nexus.app.features.booked_requests.model.BookedRequestsResponse

data class RequestFilters(val search: String = "", val status: String = "", val sortOrder: String = "desc", val page: Int = 1)

fun statusLabel(status: String): String = when (status) {
    "SUBMITTED" -> "Pending review"
    "UNDER_REVIEW" -> "Under review"
    "AWAITING_CLIENT_INFO" -> "Awaiting your information"
    "READY_FOR_QUOTATION" -> "Ready for quotation"
    "CLOSED" -> "Closed"
    "CANCELLED" -> "Cancelled"
    else -> status.lowercase().replace('_', ' ')
}
