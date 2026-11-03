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

@Serializable
data class ServicePackage(
    val id: String, val name: String, val description: String = "",
    val includedFeatures: List<String> = emptyList(),
    val pricingModel: String = "CUSTOM_QUOTE", val currency: String = "PHP",
    val amount: String? = null, val billingInterval: String? = null,
    val isPricingPublic: Boolean = false, val isActive: Boolean = true,
    val isRecommended: Boolean = false, val displayOrder: Int = 0
) {
    fun price(): String = priceLabel(pricingModel, if (isPricingPublic) amount else null, currency, billingInterval)
}

@Serializable
data class ServiceBenefit(val id: String, val title: String, val description: String = "")
@Serializable
data class ServiceDepartment(val id: String, val name: String)
@Serializable
data class CatalogService(
    val id: String, val name: String, val description: String = "",
    val iconKey: String = "business", val imageUrl: String? = null, val imageAltText: String? = null,
    val isActive: Boolean = true, val requiresConsultation: Boolean = false,
    val consultationNotes: String? = null, val clientRequirements: List<String> = emptyList(),
    val keyBenefits: List<ServiceBenefit> = emptyList(),
    val pricingTemplate: Pricing? = null, val packages: List<ServicePackage> = emptyList(),
    val departments: List<ServiceDepartment> = emptyList()
) {
    fun price(): String = pricingTemplate?.label() ?: "Contact for pricing"
}
@Serializable
data class Specialist(
    val id: String, val fullName: String, val position: String? = null,
    val imageUrl: String? = null, val department: ServiceDepartment? = null
)
@Serializable
data class SpecialistProfile(
    val id: String, val fullName: String, val position: String? = null,
    val imageUrl: String? = null, val bio: String? = null,
    val specialties: List<String> = emptyList()
)
@Serializable
data class RequestReceipt(
    val id: String, val referenceNumber: String? = null, val status: String = "SUBMITTED",
    val createdAt: String = ""
)
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
@Serializable
data class RequestRecord(
    val id: String, val title: String = "", val referenceNumber: String? = null,
    val status: String = "SUBMITTED", val acceptedDepartmentId: String? = null,
    val packageName: String? = null, val preferredSpecialistName: String? = null,
    val projectGoals: String = "", val projectRequirements: String = "",
    val expectedTimeline: String = "", val additionalDetails: String? = null,
    val pricingModel: String? = null, val quotedPrice: String? = null,
    val currency: String? = null, val billingInterval: String? = null,
    val createdAt: String = "", val updatedAt: String = "",
    val service: RequestService,
    val preferredSpecialist: Specialist? = null
) {
    val canCancel get() = status !in setOf("CANCELLED", "CLOSED")
    fun price() = priceLabel(pricingModel, quotedPrice, currency, billingInterval)
}
@Serializable
data class RequestSummary(
    val total: Int = 0, val pending: Int = 0, val inProgress: Int = 0,
    val completed: Int = 0, val cancelled: Int = 0
)
@Serializable
data class RequestsPage(
    val requests: List<RequestRecord> = emptyList(), val total: Int = 0,
    val page: Int = 1, val pageSize: Int = 10, val summary: RequestSummary = RequestSummary()
) {
    val pages get() = ((total + pageSize.coerceAtLeast(1) - 1) / pageSize.coerceAtLeast(1)).coerceAtLeast(1)
}
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
