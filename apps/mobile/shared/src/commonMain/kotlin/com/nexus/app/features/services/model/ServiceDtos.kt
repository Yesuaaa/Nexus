package com.nexus.app.features.services.model

import com.nexus.app.features.booking.model.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
data class ServiceDto(
    val id: String, val name: String, val description: String = "",
    val iconKey: String = "business", val imageUrl: String? = null, val imageAltText: String? = null,
    val isActive: Boolean = true, val requiresConsultation: Boolean = false,
    val consultationNotes: String? = null, val clientRequirements: List<String> = emptyList(),
    val keyBenefits: List<ServiceBenefit> = emptyList(),
    val pricingTemplate: Pricing? = null, val packages: List<ServicePackageDto> = emptyList(),
    val departments: List<ServiceDepartment> = emptyList()
) {
    fun price(): String = pricingTemplate?.label() ?: "Contact for pricing"
}

@Serializable
data class ServicePackageDto(
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
data class SpecialistDto(
    val id: String, val fullName: String, val position: String? = null,
    @SerialName("profileImageUrl") val imageUrl: String? = null,
    val department: ServiceDepartment? = null
)

@Serializable
data class BookingReceiptDto(
    val id: String, val referenceNumber: String? = null, val status: String = "SUBMITTED",
    val createdAt: String = ""
)
