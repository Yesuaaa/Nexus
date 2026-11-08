package com.nexus.app.features.services.api

import com.nexus.app.core.network.repositoryResult
import com.nexus.app.features.booking.api.BookingRepository
import com.nexus.app.features.services.model.ServiceDto
import com.nexus.app.features.services.model.SpecialistDto
import io.ktor.client.HttpClient

class ServicesRepository(client: HttpClient) {
    private val gateway = BookingRepository(client)

    suspend fun getServices(): Result<List<ServiceDto>> = repositoryResult { gateway.services() }

    suspend fun getServiceDetails(id: String): Result<ServiceDto> = repositoryResult { gateway.service(id) }

    suspend fun getSpecialists(serviceId: String): Result<List<SpecialistDto>> =
        repositoryResult { gateway.specialists(serviceId) }
}
