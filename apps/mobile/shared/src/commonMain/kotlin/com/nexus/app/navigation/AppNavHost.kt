package com.nexus.app.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Scaffold
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import com.nexus.app.core.components.NexusBottomBar
import com.nexus.app.core.components.NexusTopAppBar
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.components.ToastKind
import com.nexus.app.core.network.HttpClientFactory
import com.nexus.app.core.storage.SettingsTokenStorage
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.api.AuthRepository
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.screens.LoginScreen
import com.nexus.app.features.auth.screens.RegisterScreen
import com.nexus.app.features.booked_requests.screens.BookedRequestsScreen
import com.nexus.app.features.dashboard.screens.DashboardScreen
import com.nexus.app.features.profile.screens.ProfileScreen
import com.nexus.app.features.services.screens.ServicesScreen
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.dp

@Composable
fun AppNavHost(
    modifier: Modifier = Modifier
) {
    val tokenStorage = remember { SettingsTokenStorage() }
    val httpClient = remember { HttpClientFactory.create(tokenStorage = tokenStorage) }
    val authRepository = remember(httpClient) {
        AuthRepository(httpClient, tokenStorage)
    }
    var destination by remember { mutableStateOf(AuthDestination.CHECKING) }
    var currentTab by remember { mutableStateOf(BottomTab.DASHBOARD) }
    var account by remember { mutableStateOf<AuthUser?>(null) }
    var showingProfile by remember { mutableStateOf(false) }
    var loggingOut by remember { mutableStateOf(false) }
    var sessionNotice by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()
    val toast = LocalNexusToast.current

    fun acceptAccount(user: AuthUser) {
        account = user
        currentTab = BottomTab.DASHBOARD
        showingProfile = false
        sessionNotice = null
        destination = AuthDestination.MAIN
    }

    fun logout() {
        if (loggingOut) return
        loggingOut = true
        coroutineScope.launch {
            try {
                val result = authRepository.logout()
                sessionNotice = if (result.isFailure) {
                    "You are signed out on this device. We couldn't confirm sign-out with the server."
                } else {
                    null
                }
                toast.show(
                    if (result.isSuccess) "Signed out" else "Signed out on this device",
                    if (result.isSuccess) "You can sign in again at any time." else "Server sign-out could not be confirmed.",
                    if (result.isSuccess) ToastKind.SUCCESS else ToastKind.INFO
                )
            } finally {
                account = null
                showingProfile = false
                currentTab = BottomTab.DASHBOARD
                destination = AuthDestination.LOGIN
                loggingOut = false
            }
        }
    }

    DisposableEffect(httpClient) {
        onDispose { httpClient.close() }
    }
    LaunchedEffect(authRepository) {
        authRepository.restoreSession()
            .onSuccess { user ->
                if (user == null) {
                    destination = AuthDestination.LOGIN
                } else {
                    acceptAccount(user)
                }
            }
            .onFailure { destination = AuthDestination.LOGIN }
    }

    when (destination) {
        AuthDestination.CHECKING -> Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = NexusColors.PrimaryBlue)
        }
        AuthDestination.LOGIN -> LoginScreen(
            onLogin = { email, password ->
                authRepository.login(email, password).map {
                    acceptAccount(it)
                    toast.show("Signed in", "Welcome back to EXP.", ToastKind.SUCCESS)
                }
            },
            onNavigateToRegister = { destination = AuthDestination.REGISTER },
            sessionNotice = sessionNotice,
            modifier = modifier
        )
        AuthDestination.REGISTER -> RegisterScreen(
            onRegister = { fullName, contactNumber, email, password ->
                authRepository.register(fullName, contactNumber, email, password).map {
                    acceptAccount(it)
                    toast.show("Account created", "Welcome to your client portal.", ToastKind.SUCCESS)
                }
            },
            onNavigateToLogin = { destination = AuthDestination.LOGIN },
            modifier = modifier
        )
        AuthDestination.MAIN -> {
            Scaffold(
                topBar = {
                    NexusTopAppBar(
                        onNotificationClick = { /* Handle notification tap */ },
                        onProfileClick = { showingProfile = true },
                        accountActionsEnabled = !loggingOut
                    )
                },
                bottomBar = {
                    NexusBottomBar(
                        currentTab = currentTab,
                        onTabSelected = {
                            if (!loggingOut) {
                                currentTab = it
                                showingProfile = false
                            }
                        }
                    )
                },
                containerColor = NexusColors.Background,
                modifier = modifier.fillMaxSize()
            ) { paddingValues ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .background(NexusColors.Background),
                    contentAlignment = Alignment.TopCenter
                ) {
                    Box(Modifier.widthIn(max = 1120.dp).fillMaxSize()) {
                        val currentAccount = account
                        if (showingProfile && currentAccount != null) {
                            ProfileScreen(
                                user = currentAccount,
                                onBack = { showingProfile = false },
                                onLogout = { logout() },
                                loggingOut = loggingOut
                            )
                        } else {
                            when (currentTab) {
                                BottomTab.DASHBOARD -> DashboardScreen()
                                BottomTab.SERVICES -> ServicesScreen()
                                BottomTab.BOOKED_REQUESTS -> BookedRequestsScreen()
                            }
                        }
                    }
                }
            }
        }
    }
}

private enum class AuthDestination {
    CHECKING,
    LOGIN,
    REGISTER,
    MAIN
}

