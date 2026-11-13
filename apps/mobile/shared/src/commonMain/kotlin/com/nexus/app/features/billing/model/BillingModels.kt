package com.nexus.app.features.billing.model

import kotlinx.serialization.Serializable

@Serializable
data class BillingLineItem(
    val description: String,
    val quantity: Int,
    val unitPrice: String
)

@Serializable
data class BillingProofFile(
    val id: String,
    val name: String,
    val mimeType: String
)

@Serializable
data class BillingPayment(
    val id: String,
    val requestId: String,
    val serviceName: String,
    val bookingReference: String? = null,
    val amount: String,
    val currency: String = "PHP",
    val status: String,
    val reference: String? = null,
    val approvedAt: String? = null,
    val lineItems: List<BillingLineItem>? = null,
    val verifiedAt: String? = null,
    val submittedAt: String? = null,
    val sandbox: Boolean = false,
    val proofFile: BillingProofFile? = null
)
