package com.nexus.app.features.billing.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.files.PlatformFiles
import com.nexus.app.core.files.SelectedFile
import com.nexus.app.features.billing.api.BillingRepository
import com.nexus.app.features.billing.model.BillingPayment
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BillingUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val due: List<BillingPayment> = emptyList(),
    val history: List<BillingPayment> = emptyList(),
    val selectedPayment: BillingPayment? = null,
    val proofPreview: SelectedFile? = null,
    val proofPreviewLoading: Boolean = false,
    val proofPreviewError: String? = null,
    val proofExpanded: Boolean = false,
    val downloading: Boolean = false,
    val downloadError: String? = null
)

class BillingViewModel(
    private val repository: BillingRepository
) : ViewModel() {
    private val mutable = MutableStateFlow(BillingUiState())
    val state = mutable.asStateFlow()

    private var loadJob: Job? = null
    private var previewJob: Job? = null

    fun load() {
        loadJob?.cancel()
        mutable.update { it.copy(loading = true, error = null) }
        loadJob = viewModelScope.launch {
            try {
                val payments = repository.getBillingLogs()
                val due = payments
                    .filter { it.status == "PENDING" }
                    .sortedBy { it.approvedAt ?: "" }
                val history = payments.filter { it.status != "PENDING" }
                mutable.update {
                    it.copy(
                        loading = false,
                        error = null,
                        due = due,
                        history = history
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                mutable.update {
                    it.copy(
                        loading = false,
                        error = e.message ?: "Could not load billing records."
                    )
                }
            }
        }
    }

    fun selectPayment(payment: BillingPayment) {
        previewJob?.cancel()
        val file = payment.proofFile
        val shouldLoadImage = file != null &&
            !payment.sandbox &&
            file.mimeType in listOf("image/png", "image/jpeg")

        mutable.update {
            it.copy(
                selectedPayment = payment,
                proofPreview = null,
                proofPreviewLoading = shouldLoadImage,
                proofPreviewError = null,
                proofExpanded = false,
                downloadError = null
            )
        }

        if (shouldLoadImage && file != null) {
            previewJob = viewModelScope.launch {
                try {
                    val downloaded = repository.downloadProofFile(payment.requestId, file)
                    mutable.update { current ->
                        if (current.selectedPayment?.id == payment.id) {
                            current.copy(proofPreview = downloaded, proofPreviewLoading = false)
                        } else {
                            current
                        }
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    mutable.update { current ->
                        if (current.selectedPayment?.id == payment.id) {
                            current.copy(
                                proofPreviewLoading = false,
                                proofPreviewError = "Couldn't load image preview."
                            )
                        } else {
                            current
                        }
                    }
                }
            }
        }
    }

    fun dismissDialog() {
        if (state.value.downloading) return
        previewJob?.cancel()
        mutable.update {
            it.copy(
                selectedPayment = null,
                proofPreview = null,
                proofPreviewLoading = false,
                proofPreviewError = null,
                proofExpanded = false,
                downloadError = null
            )
        }
    }

    fun toggleProofExpanded() {
        mutable.update { it.copy(proofExpanded = !it.proofExpanded) }
    }

    fun downloadProof(platformFiles: PlatformFiles) {
        val current = state.value
        val payment = current.selectedPayment ?: return
        val file = payment.proofFile ?: return
        if (current.downloading) return

        mutable.update { it.copy(downloading = true, downloadError = null) }
        viewModelScope.launch {
            try {
                val downloaded = current.proofPreview?.takeIf { it.name == file.name }
                    ?: repository.downloadProofFile(payment.requestId, file)
                platformFiles.save(downloaded)
                mutable.update { it.copy(downloading = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                mutable.update {
                    it.copy(
                        downloading = false,
                        downloadError = e.message ?: "Could not download the file."
                    )
                }
            }
        }
    }
}
