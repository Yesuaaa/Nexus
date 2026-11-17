package com.nexus.app.features.billing.api

import com.nexus.app.core.files.SelectedFile
import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.features.billing.model.BillingPayment
import com.nexus.app.features.billing.model.BillingProofFile
import com.nexus.app.features.conversations.api.CommunicationException
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable

@Serializable
private data class BillingErrorBody(val error: String = "Could not load billing records.")

class BillingRepository(private val client: HttpClient) {
    private suspend inline fun <reified T> HttpResponse.checked(): T {
        if (!status.isSuccess()) {
            val message = try {
                body<BillingErrorBody>().error
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (_: Exception) {
                "Could not load billing records."
            }
            throw CommunicationException(status.value, message)
        }
        return body()
    }

    suspend fun getBillingLogs(): List<BillingPayment> =
        client.get(ApiEndpoints.BILLING_LOGS).checked()

    suspend fun downloadProofFile(requestId: String, file: BillingProofFile): SelectedFile {
        val response = client.get(ApiEndpoints.workflowFileDownload(requestId, file.id))
        if (!response.status.isSuccess()) {
            throw CommunicationException(response.status.value, "Could not download the file.")
        }
        return SelectedFile(file.name, file.mimeType, response.bodyAsBytes())
    }
}
