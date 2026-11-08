package com.nexus.app.features.booked_requests.model

import com.nexus.app.features.booking.model.*
import kotlinx.serialization.Serializable

@Serializable
data class BookedRequestDto(
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
data class RequestKpisDto(
    val total: Int = 0, val pending: Int = 0, val inProgress: Int = 0,
    val completed: Int = 0, val cancelled: Int = 0
)

@Serializable
data class BookedRequestsResponse(
    val requests: List<BookedRequestDto> = emptyList(), val total: Int = 0,
    val page: Int = 1, val pageSize: Int = 10, val summary: RequestKpisDto = RequestKpisDto()
) {
    val pages get() = ((total + pageSize.coerceAtLeast(1) - 1) / pageSize.coerceAtLeast(1)).coerceAtLeast(1)
}
