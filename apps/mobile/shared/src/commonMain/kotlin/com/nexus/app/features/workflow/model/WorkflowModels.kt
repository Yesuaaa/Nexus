package com.nexus.app.features.workflow.model

import kotlinx.serialization.Serializable

@Serializable data class WorkflowRequest(val id: String = "", val title: String = "", val referenceNumber: String? = null, val serviceName: String = "", val goals: String = "", val requirements: String = "", val packageName: String? = null, val pricingModel: String? = null, val expectedTimeline: String = "", val department: WorkflowDepartment? = null)
@Serializable data class WorkflowDepartment(val id: String = "", val name: String = "")
@Serializable data class ClientPermissions(val isClient: Boolean = false)
@Serializable data class Requirement(val id: String, val title: String, val details: String? = null, val status: String = "", val submission: String? = null)
@Serializable data class Consultation(val id: String, val startsAt: String, val endsAt: String, val location: String, val status: String, val notes: String? = null)
@Serializable data class Quotation(val id: String, val version: Int, val status: String, val scope: String, val deliverables: List<String> = emptyList(), val total: String, val currency: String, val timeline: String = "", val paymentTerms: String = "", val validUntil: String)
@Serializable data class Agreement(val status: String, val documentFileId: String? = null, val signedFileId: String? = null)
@Serializable data class Payment(val status: String, val amount: String, val currency: String, val reference: String? = null, val proofFileId: String? = null)
@Serializable data class WorkflowFile(val id: String, val name: String, val mimeType: String, val size: Int, val uploaderId: String = "", val createdAt: String = "")
@Serializable data class WorkflowProject(val id: String, val name: String, val status: String)
@Serializable data class WorkflowEvent(val id: String, val summary: String, val createdAt: String)
/** Explicit client projection: internal assignments, approvers and verification notes are never decoded. */
@Serializable data class ClientWorkflow(val request: WorkflowRequest, val state: String, val version: Int, val nextAction: String,
    val permissions: ClientPermissions, val requirements: List<Requirement> = emptyList(), val consultations: List<Consultation> = emptyList(),
    val quotations: List<Quotation> = emptyList(), val agreement: Agreement? = null, val payment: Payment? = null,
    val files: List<WorkflowFile> = emptyList(), val project: WorkflowProject? = null, val events: List<WorkflowEvent> = emptyList())
@Serializable data class Milestone(val id: String, val title: String, val completedAt: String? = null)
@Serializable data class ProjectWorkspace(val id: String, val name: String, val status: String, val description: String? = null,
    val canManage: Boolean = false, val milestones: List<Milestone> = emptyList())

fun ClientWorkflow.canAttachFile(): Boolean = permissions.isClient && state in setOf(
    "CONSULTATION", "QUOTATION_PENDING", "CLIENT_APPROVAL", "REVISION_REQUESTED",
    "AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION", "ACTIVE_PROJECT",
)
