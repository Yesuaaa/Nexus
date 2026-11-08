package com.nexus.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Assignment
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Widgets
import androidx.compose.ui.graphics.vector.ImageVector

enum class BottomTab(
    val label: String,
    val icon: ImageVector
) {
    DASHBOARD("Dashboard", Icons.Outlined.GridView),
    SERVICES("Services", Icons.Outlined.Widgets),
    BOOKED_REQUESTS("Booked Requests", Icons.AutoMirrored.Outlined.Assignment)
}

sealed class Screen(val route: String) {
    // Auth Routes
    data object Login : Screen("login")
    data object Register : Screen("register")

    // Main App Shell
    data object Main : Screen("main")

    // Sub-screens & Wizards
    data object ServiceDetails : Screen("service_details/{serviceId}") {
        fun createRoute(serviceId: String) = "service_details/$serviceId"
    }

    data object BookingWizard : Screen("booking_wizard/{serviceId}") {
        fun createRoute(serviceId: String) = "booking_wizard/$serviceId"
    }

    data object RequestDetails : Screen("request_details/{requestId}") {
        fun createRoute(requestId: String) = "request_details/$requestId"
    }

    data object ChatThread : Screen("chat/{requestId}") {
        fun createRoute(requestId: String) = "chat/$requestId"
    }
}

