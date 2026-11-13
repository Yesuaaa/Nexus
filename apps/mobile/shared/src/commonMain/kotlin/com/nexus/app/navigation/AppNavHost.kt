package com.nexus.app.navigation

import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.components.NexusBottomBar
import com.nexus.app.core.components.NexusTopAppBar
import com.nexus.app.core.components.ToastKind
import com.nexus.app.core.session.SessionManager
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.api.AuthRepository
import com.nexus.app.features.auth.api.SessionRestoration
import com.nexus.app.features.auth.screens.LoginScreen
import com.nexus.app.features.auth.screens.RegisterScreen
import com.nexus.app.features.booked_requests.screens.BookedRequestsScreen
import com.nexus.app.features.dashboard.screens.DashboardScreen
import com.nexus.app.features.profile.screens.ProfileScreen
import com.nexus.app.features.services.screens.ServicesScreen
import kotlinx.coroutines.launch
import kotlinx.coroutines.awaitCancellation
import org.koin.compose.koinInject

import com.nexus.app.features.conversations.screens.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.koin.compose.viewmodel.koinViewModel
import com.nexus.app.features.notifications.viewmodel.NotificationsViewModel

import com.nexus.app.features.projects.screens.*

object Routes {
    const val CHECKING = "checking"
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val DASHBOARD = "dashboard"
    const val SERVICES = "services"
    const val BOOKED_REQUESTS = "booked_requests"
    const val CALENDAR = "calendar"
    const val PROJECTS = "projects"
    const val PROJECT_DETAILS = "projects/{projectId}/details"
    const val PROJECT_OVERVIEW = "projects/{projectId}/overview?tab={tab}"
    const val PROJECT_BRIEF = "projects/{projectId}/brief"
    const val PROJECT_REQUEST = "projects/{projectId}/request"
    const val PROJECT_CHAT = "projects/{projectId}/chat"
    const val NOTIFICATIONS = "notifications"
    const val MESSAGES = "messages"
    const val CHAT = "chat/{conversationId}"
    const val WORKFLOW = "workflow/{requestId}?conversationId={conversationId}&documents={documents}"
    const val PROFILE = "profile"
    const val SETTINGS = "settings"
    const val REQUEST_DETAIL = "request/{requestId}"

    val main = setOf(NOTIFICATIONS, MESSAGES, CHAT, WORKFLOW, DASHBOARD, SERVICES, BOOKED_REQUESTS, PROFILE, SETTINGS, REQUEST_DETAIL, CALENDAR, PROJECTS, PROJECT_DETAILS, PROJECT_OVERVIEW, PROJECT_BRIEF, PROJECT_REQUEST, PROJECT_CHAT)
}

private fun BottomTab.route() = when (this) {
    BottomTab.DASHBOARD -> Routes.DASHBOARD
    BottomTab.SERVICES -> Routes.SERVICES
    BottomTab.BOOKED_REQUESTS -> Routes.BOOKED_REQUESTS
    BottomTab.CALENDAR -> Routes.CALENDAR
    BottomTab.PROJECTS -> Routes.PROJECTS
}

private fun routeToTab(route: String?): BottomTab? = when (route) {
    Routes.DASHBOARD -> BottomTab.DASHBOARD
    Routes.SERVICES -> BottomTab.SERVICES
    Routes.BOOKED_REQUESTS, Routes.REQUEST_DETAIL -> BottomTab.BOOKED_REQUESTS
    Routes.CALENDAR -> BottomTab.CALENDAR
    Routes.PROJECTS, Routes.PROJECT_DETAILS, Routes.PROJECT_OVERVIEW, Routes.PROJECT_BRIEF, Routes.PROJECT_REQUEST, Routes.PROJECT_CHAT -> BottomTab.PROJECTS
    else -> null
}

/** Session boundaries discard active entries and every independently saved tab stack. */
internal fun NavController.resetTo(route: String) {
    if (route == Routes.LOGIN || route == Routes.DASHBOARD) {
        Routes.main.forEach { clearBackStack(it) }
    }
    navigate(route) {
        popUpTo(graph.id) { inclusive = true }
        launchSingleTop = true
    }
}

internal fun NavController.switchTab(route: String) {
    navigate(route) {
        popUpTo(Routes.DASHBOARD) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/** A transient connection error keeps the existing account's destinations underneath Retry. */
internal fun NavController.restoreAuthenticatedDestination() {
    if (currentBackStackEntry?.destination?.route in Routes.main) return
    if (previousBackStackEntry?.destination?.route in Routes.main) {
        popBackStack()
    } else {
        resetTo(Routes.DASHBOARD)
    }
}

@Composable
fun AppNavHost(modifier: Modifier = Modifier) {
    val authRepository = koinInject<AuthRepository>()
    val session = koinInject<SessionManager>()
    val navController = rememberNavController()
    val coroutineScope = rememberCoroutineScope()
    val toast = LocalNexusToast.current

    val notificationViewModel: NotificationsViewModel = koinViewModel()
    val notificationState by notificationViewModel.state.collectAsState()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val sessionState by session.state.collectAsState()
    val user = sessionState.user
    LaunchedEffect(user?.id, sessionState.generation, lifecycle) {
        notificationViewModel.reset()
        if (user != null) lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (isActive) { notificationViewModel.refresh(); delay(30_000) }
        }
    }
    val notice = sessionState.notice
    val pendingLink by DeepLinks.pending.collectAsState()
    var restorationAttempt by rememberSaveable { mutableStateOf(0) }
    var restorationError by remember { mutableStateOf<String?>(null) }
    var loggingOut by rememberSaveable { mutableStateOf(false) }
    var editingAccount by remember { mutableStateOf(false) }
    var accountMenuOpen by remember { mutableStateOf(false) }
    var lastTab by remember { mutableStateOf(BottomTab.DASHBOARD) }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val route = backStackEntry?.destination?.route
    routeToTab(route)?.let { lastTab = it }

    // Revalidate on every resume and explicit retry. Cancellation never discards credentials.
    LaunchedEffect(restorationAttempt, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            restorationError = null
            when (authRepository.restoreClientSession()) {
                SessionRestoration.SignedOut -> {
                    if (session.state.value.signedOut) navController.resetTo(Routes.LOGIN)
                }
                is SessionRestoration.VerifiedClient, is SessionRestoration.CachedOfflineClient -> {
                    if (session.state.value.user != null) navController.restoreAuthenticatedDestination()
                }
                is SessionRestoration.TemporarilyUnavailable -> {
                    restorationError = "Can't restore your session right now. Check your connection and retry."
                    navController.navigate(Routes.CHECKING) { launchSingleTop = true }
                }
            }
            awaitCancellation()
        }
    }

    // Deep links: wait until restore has finished (route is a main screen or Login/Register).
    LaunchedEffect(pendingLink, user, route) {
        val link = pendingLink ?: return@LaunchedEffect
        when {
            // Signed out: drop the link (it is not remembered across sign-in).
            route == Routes.LOGIN || route == Routes.REGISTER -> DeepLinks.consume()
            user != null && route in Routes.main -> {
                val target = DeepLinks.routeFor(link)
                if (target != null && target != route) navController.switchTab(target)
                DeepLinks.consume()
            }
        }
    }

    // Durable state also handles expiry while no event collector is present.
    LaunchedEffect(sessionState.signedOut, sessionState.generation, route) {
        if (sessionState.signedOut && route != Routes.LOGIN && route != Routes.REGISTER) {
            navController.resetTo(Routes.LOGIN)
        }
    }

    fun signedIn() {
        if (session.state.value.user != null && !session.state.value.signedOut) {
            navController.resetTo(Routes.DASHBOARD)
        }
    }

    fun logout() {
        if (loggingOut) return
        loggingOut = true
        coroutineScope.launch {
            try {
                val result = authRepository.logout()
                if (session.state.value.signedOut) toast.show(
                    if (result.isSuccess) "Signed out" else "Signed out on this device",
                    if (result.isSuccess) "You can sign in again at any time." else "Server sign-out could not be confirmed.",
                    if (result.isSuccess) ToastKind.SUCCESS else ToastKind.INFO
                )
            } finally {
                loggingOut = false
            }
        }
    }

    fun closeHeaderPage() {
        if (!navController.popBackStack()) navController.switchTab(lastTab.route())
    }

    fun toggleHeaderPage(target: String) {
        if (route == target) closeHeaderPage()
        else navController.navigate(target) { launchSingleTop = true }
    }

    var accountTitle by remember(route) {
        mutableStateOf(if (route == Routes.SETTINGS) "Settings" else "Profile")
    }
    val pageTitle = when (route) {
        Routes.DASHBOARD -> "Dashboard"
        Routes.SERVICES -> "Services"
        Routes.BOOKED_REQUESTS -> "Booked Requests"
        Routes.CALENDAR -> "Calendar"
        Routes.PROJECTS -> "My Projects"
        Routes.PROJECT_DETAILS -> "Project details"
        Routes.PROJECT_OVERVIEW -> "Project overview"
        Routes.PROJECT_BRIEF -> "Edit project brief"
        Routes.PROJECT_REQUEST -> "Project change"
        Routes.PROJECT_CHAT -> "Project chat"
        Routes.REQUEST_DETAIL -> "Request details"
        Routes.NOTIFICATIONS -> "Notifications"
        Routes.MESSAGES -> "Messages"
        Routes.CHAT -> "Chat"
        Routes.WORKFLOW -> "Request details"
        Routes.PROFILE, Routes.SETTINGS -> accountTitle
        else -> ""
    }
    val showBars = user != null && !sessionState.signedOut && route in Routes.main

    Scaffold(
        topBar = {
            if (showBars && route != Routes.CHAT) {
                NexusTopAppBar(
                    title = pageTitle,
                    onNotificationClick = { toggleHeaderPage(Routes.NOTIFICATIONS) },
                    onChatClick = { toggleHeaderPage(Routes.MESSAGES) },
                    onProfileClick = {
                        if (route != Routes.PROFILE) navController.navigate(Routes.PROFILE) { launchSingleTop = true }
                    },
                    onSettingsClick = { if (route != Routes.SETTINGS) navController.navigate(Routes.SETTINGS) { launchSingleTop = true } },
                    onLogoutClick = { logout() },
                    accountName = user.fullName ?: "Your account",
                    accountEmail = user.email,
                    accountPageOpen = route in setOf(Routes.PROFILE, Routes.SETTINGS),
                    onCloseAccountPage = { closeHeaderPage() },
                    onAccountMenuChange = { accountMenuOpen = it },
                    notificationUnread = notificationState.feed.unreadCount,
                    accountActionsEnabled = !loggingOut
                )
            }
        },
        bottomBar = {
            if (showBars && !editingAccount && route !in setOf(Routes.CHAT, Routes.WORKFLOW, Routes.PROJECT_CHAT)) {
                NexusBottomBar(
                    currentTab = if (accountMenuOpen) null else routeToTab(route),
                    onTabSelected = { tab ->
                        if (!loggingOut) {
                            // An explicit tab tap opens that page, without restoring a header screen above it.
                            navController.navigate(tab.route()) {
                                popUpTo(Routes.DASHBOARD)
                                launchSingleTop = true
                            }
                        }
                    }
                )
            }
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
            Column(Modifier.widthIn(max = 1120.dp).fillMaxSize()) {
                if (sessionState.offline && route in Routes.main) {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Text("Offline session. Your identity was previously verified. Connect to refresh your session.", color = NexusColors.TextSecondary)
                        Button(shape = NexusButtonShape, onClick = { restorationAttempt++ }) { Text("Retry connection") }
                    }
                }
                NavHost(
                    navController = navController,
                    modifier = Modifier.weight(1f),
                    startDestination = Routes.CHECKING
                ) {
                    composable(Routes.CHECKING) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            if (restorationError == null) {
                                CircularProgressIndicator(color = NexusColors.PrimaryBlue)
                            } else {
                                Column(
                                    Modifier.padding(24.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(16.dp)
                                ) {
                                    Text(restorationError!!, color = NexusColors.TextSecondary)
                                    Button(shape = NexusButtonShape, onClick = { restorationAttempt++ }) { Text("Retry") }
                                }
                            }
                        }
                    }
                    composable(Routes.LOGIN) {
                        LoginScreen(
                            onLoggedIn = {
                                signedIn()
                                toast.show("Signed in", "Welcome back to EXP.", ToastKind.SUCCESS)
                            },
                            onNavigateToRegister = { navController.navigate(Routes.REGISTER) },
                            sessionNotice = notice
                        )
                    }
                    composable(Routes.REGISTER) {
                        RegisterScreen(
                            onRegistered = {
                                signedIn()
                                toast.show("Account created", "Welcome to your client portal.", ToastKind.SUCCESS)
                            },
                            onNavigateToLogin = { navController.popBackStack() }
                        )
                    }
                    composable(Routes.NOTIFICATIONS) { NotificationsScreen(onRequest = { navController.navigate("workflow/$it") }, viewModel = notificationViewModel) }
                    composable(Routes.MESSAGES) { MessagesScreen(onConversation = { navController.navigate("chat/$it") }) }
                    composable(Routes.CHAT) { entry ->
                        val id = entry.arguments?.getString("conversationId") ?: return@composable
                        val selectedBookingId by entry.savedStateHandle.getStateFlow<String?>("selectedBookingId", null).collectAsState()
                        ChatScreen(id, user?.id ?: "", selectedBookingId = selectedBookingId, onBack = { navController.popBackStack() },
                            onDetails = { bookingId -> navController.navigate("workflow/$bookingId?conversationId=$id") },
                            onBooking = { navController.navigate("workflow/$it?conversationId=$id&documents=true") })
                    }
                    composable(Routes.WORKFLOW, arguments = listOf(navArgument("conversationId") { nullable = true; defaultValue = null }, navArgument("documents") { type = NavType.BoolType; defaultValue = false })) { entry ->
                        val id = entry.arguments?.getString("requestId") ?: return@composable
                        com.nexus.app.features.workflow.screens.WorkflowScreen(id, onBack = { navController.popBackStack() }, conversationId = entry.arguments?.getString("conversationId"), initialDocuments = entry.arguments?.getBoolean("documents") ?: false,
                            onOpenThread = { bookingId ->
                                val chatEntry = navController.previousBackStackEntry?.takeIf { it.destination.route == Routes.CHAT }
                                if (chatEntry != null) {
                                    chatEntry.savedStateHandle["selectedBookingId"] = bookingId
                                    navController.popBackStack()
                                }
                            },
                            onBookingSelected = { bookingId ->
                                navController.previousBackStackEntry?.takeIf { it.destination.route == Routes.CHAT }
                                    ?.savedStateHandle?.set("selectedBookingId", bookingId)
                            })
                    }
                    composable(Routes.CALENDAR) {
                        CalendarScreen(
                            onBooking = { navController.switchTab(Routes.SERVICES) },
                            onEvent = { event ->
                                val targetId = event.href.substringAfterLast('/').substringAfter("request=")
                                if (targetId.matches(Regex("[A-Za-z0-9_-]{1,80}"))) {
                                    when (event.type) {
                                        "milestone" -> navController.navigate("projects/$targetId/overview")
                                        "meeting" -> navController.navigate("chat/$targetId")
                                        else -> navController.navigate("workflow/$targetId")
                                    }
                                }
                            }
                        )
                    }
                    composable(Routes.PROJECTS) {
                        MyProjectsScreen(
                            onNewRequest = { navController.switchTab(Routes.SERVICES) },
                            onProject = { navController.navigate("projects/$it/details") }
                        )
                    }
                    composable(Routes.PROJECT_DETAILS) { entry ->
                        val id = entry.arguments?.getString("projectId") ?: return@composable
                        ProjectScreen(id, overview = false,
                            onBack = { navController.popBackStack() },
                            onOpen = { navController.navigate("projects/$id/overview") },
                            onEdit = { navController.navigate("projects/$id/brief") },
                            onRequest = { navController.navigate("projects/$id/request") },
                            onChat = { navController.navigate("projects/$id/chat") })
                    }
                    composable(Routes.PROJECT_OVERVIEW, arguments = listOf(navArgument("tab") { defaultValue = "OVERVIEW" })) { entry ->
                        val id = entry.arguments?.getString("projectId") ?: return@composable
                        ProjectScreen(id, overview = true,
                            onBack = { navController.navigate(Routes.PROJECTS) { popUpTo(Routes.DASHBOARD); launchSingleTop = true } },
                            onOpen = {},
                            onEdit = { navController.navigate("projects/$id/brief") },
                            onRequest = { navController.navigate("projects/$id/request") },
                            onChat = { navController.navigate("projects/$id/chat") },
                            initialTab = entry.arguments?.getString("tab") ?: "OVERVIEW")
                    }
                    composable(Routes.PROJECT_BRIEF) { entry ->
                        val id = entry.arguments?.getString("projectId") ?: return@composable
                        ProjectFormScreen(id, edit = true, onBack = { navController.popBackStack() })
                    }
                    composable(Routes.PROJECT_REQUEST) { entry ->
                        val id = entry.arguments?.getString("projectId") ?: return@composable
                        ProjectFormScreen(id, edit = false, onBack = { navController.popBackStack() })
                    }
                    composable(Routes.PROJECT_CHAT) { entry ->
                        val id = entry.arguments?.getString("projectId") ?: return@composable
                        ProjectChatScreen(id, user?.id.orEmpty(), onBack = { navController.popBackStack() },
                            onDeliverables = { navController.navigate("projects/$id/overview?tab=DELIVERABLES") })
                    }
                    composable(Routes.DASHBOARD) { DashboardScreen() }
                    composable(Routes.SERVICES) {
                        ServicesScreen(
                            onBookedRequests = { navController.switchTab(Routes.BOOKED_REQUESTS) },
                            onRequestCreated = { id -> navController.navigate("request/$id") }
                        )
                    }
                    composable(Routes.BOOKED_REQUESTS) {
                        BookedRequestsScreen(onNewRequestClick = { navController.switchTab(Routes.SERVICES) })
                    }
                    composable(Routes.REQUEST_DETAIL) { entry ->
                        BookedRequestsScreen(
                            onNewRequestClick = { navController.switchTab(Routes.SERVICES) },
                            initialRequestId = entry.arguments?.getString("requestId"),
                            onBackFromDetails = { navController.popBackStack() }
                        )
                    }
                    composable(Routes.SETTINGS) {
                        user?.let { current -> ProfileScreen(current, initialSettings = true, onEditingChange = { editingAccount = it }, onTitleChange = { accountTitle = it }) }
                    }
                    composable(Routes.PROFILE) {
                        val current = user
                        if (current == null) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = NexusColors.PrimaryBlue)
                            }
                        } else {
                            ProfileScreen(
                                user = current,
                                onTitleChange = { accountTitle = it },
                                onEditingChange = { editingAccount = it }
                            )
                        }
                    }
                }
            }
        }
    }
}
