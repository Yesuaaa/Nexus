package com.nexus.app.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.nexus.app.core.components.NexusBottomBar
import com.nexus.app.core.components.NexusTopAppBar
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.screens.LoginScreen
import com.nexus.app.features.booked_requests.screens.BookedRequestsScreen
import com.nexus.app.features.dashboard.screens.DashboardScreen
import com.nexus.app.features.services.screens.ServicesScreen

@Composable
fun AppNavHost(
    initialIsAuthenticated: Boolean = true,
    modifier: Modifier = Modifier
) {
    var isAuthenticated by remember { mutableStateOf(initialIsAuthenticated) }
    var currentTab by remember { mutableStateOf(BottomTab.DASHBOARD) }

    if (!isAuthenticated) {
        LoginScreen(
            onLoginSuccess = { isAuthenticated = true },
            modifier = modifier
        )
    } else {
        Scaffold(
            topBar = {
                NexusTopAppBar(
                    onNotificationClick = { /* Handle notification tap */ }
                )
            },
            bottomBar = {
                NexusBottomBar(
                    currentTab = currentTab,
                    onTabSelected = { currentTab = it }
                )
            },
            containerColor = NexusColors.Background,
            modifier = modifier.fillMaxSize()
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .background(NexusColors.Background)
            ) {
                when (currentTab) {
                    BottomTab.DASHBOARD -> DashboardScreen()
                    BottomTab.SERVICES -> ServicesScreen()
                    BottomTab.BOOKED_REQUESTS -> BookedRequestsScreen()
                }
            }
        }
    }
}

