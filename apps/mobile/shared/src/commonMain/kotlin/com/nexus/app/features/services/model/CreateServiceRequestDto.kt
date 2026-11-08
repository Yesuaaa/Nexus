package com.nexus.app.features.services.model

import kotlinx.serialization.Serializable

/** Keep the UUID submission key separately and reuse it when retrying the same booking. */
@Serializable
data class CreateServiceRequestDto(
    val serviceId: String,
    val goals: String,
    val requirements: String,
    val expectedTimeline: String,
    val packageId: String? = null,
    val preferredSpecialistId: String? = null,
    val additionalDetails: String = ""
)
