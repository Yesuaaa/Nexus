package com.nexus.app.features.workflow.model

import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable

@Serializable data class WorkflowRequest(val id: String = "", val title: String = "", val referenceNumber: String? = null, val serviceName: String = "", val goals: String = "", val requirements: String = "", val packageName: String? = null, val pricingModel: String? = null, val expectedTimeline: String = "", val department: WorkflowDepartment? = null)
@Serializable data class WorkflowDepartment(val id: String = "", val name: String = "")
@Serializable data class ClientPermissions(val isClient: Boolean = false)
@Serializable data class Requirement(val id: String, val title: String, val details: String? = null, val status: String = "", val submission: String? = null)
@Serializable data class Consultation(val id: String, val startsAt: String, val endsAt: String, val location: String, val status: String, val notes: String? = null)
@Serializable data class QuotationLineItem(val description: String = "", val quantity: Int = 1, val unitPrice: String = "0.00")
@Serializable data class Quotation(
    val id: String, val version: Int, val status: String, val scope: String,
    val deliverables: List<String> = emptyList(), val total: String, val currency: String,
    val timeline: String = "", val paymentTerms: String = "", val validUntil: String,
    val lineItems: List<QuotationLineItem> = emptyList(), val paymentDue: String = "",
    val decisionNote: String? = null,
)
@Serializable data class WorkflowApproval(
    val quotationId: String = "", val amount: String = "", val currency: String = "PHP",
    val approvedAt: String = "", val approvedById: String = "",
)
@Serializable data class Agreement(val status: String, val documentFileId: String? = null, val signedFileId: String? = null)
@Serializable data class Payment(val status: String, val amount: String, val currency: String, val reference: String? = null, val proofFileId: String? = null)
@Serializable data class WorkflowFile(val id: String, val name: String, val mimeType: String, val size: Int, val uploaderId: String = "", val createdAt: String = "")
@Serializable data class WorkflowProject(val id: String, val name: String, val status: String)
@Serializable data class WorkflowEvent(val id: String, val summary: String, val createdAt: String)
/** Explicit client projection: internal assignments, approvers and verification notes are never decoded. */
@Serializable data class ClientWorkflow(val request: WorkflowRequest, val state: String, val version: Int, val nextAction: String,
    val permissions: ClientPermissions, val requirements: List<Requirement> = emptyList(), val consultations: List<Consultation> = emptyList(),
    val quotations: List<Quotation> = emptyList(), val agreement: Agreement? = null, val payment: Payment? = null,
    val files: List<WorkflowFile> = emptyList(), val project: WorkflowProject? = null, val events: List<WorkflowEvent> = emptyList(),
    val approval: WorkflowApproval? = null)
@Serializable data class Milestone(val id: String, val title: String, val completedAt: String? = null)
@Serializable data class ProjectWorkspace(val id: String, val name: String, val status: String, val description: String? = null,
    val canManage: Boolean = false, val milestones: List<Milestone> = emptyList())

fun ClientWorkflow.canAttachFile(): Boolean = permissions.isClient && state in setOf(
    "CONSULTATION", "QUOTATION_PENDING", "CLIENT_APPROVAL", "REVISION_REQUESTED",
    "AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION", "ACTIVE_PROJECT",
)

const val SANDBOX_CARD_NUMBER = "4000000000000002"

fun formatSandboxCardNumber(value: String): String =
    value.filter { it in '0'..'9' }.take(16).chunked(4).joinToString(" ")

fun formatSandboxExpiry(value: String): String {
    val digits = value.filter { it in '0'..'9' }.take(4)
    return if (digits.length > 2) "${digits.take(2)}/${digits.drop(2)}" else digits
}

fun validateSandboxCard(
    cardholder: String,
    cardNumber: String,
    expiry: String,
    cvc: String,
    todayYear: Int? = null,
    todayMonth: Int? = null,
): String? {
    val digits = cardNumber.filter { it in '0'..'9' }
    if (digits != SANDBOX_CARD_NUMBER) return "Use the prefilled sandbox card number for this prototype."
    if (!Regex("^(0[1-9]|1[0-2])/[0-9]{2}$").matches(expiry)) return "Enter a valid expiry date in MM/YY format."
    val today = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).date
    val refYear = todayYear ?: today.year
    val refMonth = todayMonth ?: today.monthNumber
    val month = expiry.take(2).toInt()
    val year = 2000 + expiry.takeLast(2).toInt()
    if (year < refYear || (year == refYear && month < refMonth)) return "Enter a future expiry date."
    if (!Regex("^[0-9]{3}$").matches(cvc)) return "Enter the 3-digit sandbox security code."
    if (cardholder.isBlank()) return "Enter the cardholder name."
    return null
}

fun Payment.isVerifiedSandboxPayment(): Boolean =
    status == "VERIFIED" && reference?.startsWith("XENDIT-SANDBOX-") == true
