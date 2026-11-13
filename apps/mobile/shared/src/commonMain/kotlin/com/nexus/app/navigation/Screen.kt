package com.nexus.app.navigation

import com.nexus.app.core.components.NexusNavIcons
import androidx.compose.ui.graphics.vector.ImageVector

enum class BottomTab(
    val label: String,
    val icon: ImageVector
) {
    DASHBOARD("Dashboard", NexusNavIcons.Dashboard),
    SERVICES("Services", NexusNavIcons.Services),
    CALENDAR("Calendar", NexusNavIcons.Calendar),
    BOOKED_REQUESTS("Requests", NexusNavIcons.BookedRequests),
    PROJECTS("Projects", NexusNavIcons.Projects)
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
