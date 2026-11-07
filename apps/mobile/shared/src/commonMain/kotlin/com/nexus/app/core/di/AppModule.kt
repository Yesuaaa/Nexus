package com.nexus.app.core.di

import com.nexus.app.core.network.HttpClientFactory
import com.nexus.app.core.session.SessionManager
import com.nexus.app.core.storage.SettingsTokenStorage
import com.nexus.app.features.auth.api.AuthRepository
import com.nexus.app.features.auth.viewmodel.AuthViewModel
import com.nexus.app.features.auth.viewmodel.RegisterViewModel
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

val appModule = module {
    single { com.nexus.app.features.workflow.api.WorkflowRepository(get()) }
    viewModel { com.nexus.app.features.workflow.viewmodel.WorkflowViewModel(get()) }

    single { com.nexus.app.features.conversations.api.ClientCommunicationRepository(get()) }
    viewModel { com.nexus.app.features.conversations.viewmodel.ConversationsViewModel(get(), get(), get()) }
    viewModel { com.nexus.app.features.notifications.viewmodel.NotificationsViewModel(get()) }

    single { com.nexus.app.features.services.api.ServicesRepository(get()) }
    single { com.nexus.app.features.booked_requests.api.BookedRequestsRepository(get()) }
    single { com.nexus.app.features.booking.api.BookingRepository(get()) }
    single<com.nexus.app.features.booking.api.BookingGateway> {
        get<com.nexus.app.features.booking.api.BookingRepository>()
    }
    viewModel { com.nexus.app.features.booking.viewmodel.BookingViewModel(get()) }
    viewModel { com.nexus.app.features.booked_requests.viewmodel.RequestsViewModel(get()) }

    single { SessionManager() }
    single { SettingsTokenStorage() }
    single {
        val session = get<SessionManager>()
        HttpClientFactory.create(
            tokenStorage = get<SettingsTokenStorage>(),
            onSessionExpired = { session.expire() }
        )
    }
    single { AuthRepository(get(), get<SettingsTokenStorage>()) }

    viewModel {
        val repository = get<AuthRepository>()
        AuthViewModel { email, password -> repository.login(email, password) }
    }
    viewModel {
        val repository = get<AuthRepository>()
        RegisterViewModel { fullName, contactNumber, email, password ->
            repository.register(fullName, contactNumber, email, password)
        }
    }
}
