package com.nexus.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.unit.dp
import com.nexus.app.core.components.*
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.profile.screens.ProfileScreen
import com.nexus.app.features.auth.screens.LoginScreen
import com.nexus.app.features.auth.viewmodel.AuthViewModel
import com.nexus.app.features.booking.FakeBookingGateway
import com.nexus.app.features.booking.viewmodel.BookingViewModel
import com.nexus.app.features.services.screens.ServicesScreen
import com.nexus.app.features.booked_requests.screens.BookedRequestsScreen
import com.nexus.app.features.booked_requests.viewmodel.RequestsViewModel
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.assertEquals

class MobileUiRegressionTest {
    @get:Rule val compose = createComposeRule()
    private val user = AuthUser("client", "mobile@example.com", role = "USER", isActive = true)

    @Test fun emptyLoginShowsValidationWithoutMakingANetworkCall() {
        var calls = 0
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    val vm = remember { AuthViewModel { _, _ -> calls++; Result.success(user) } }
                    LoginScreen(onLoggedIn = {}, viewModel = vm)
                }
            }
        }
        // The header also has a Sign In mode switch; the final button submits the form.
        compose.onAllNodesWithText("Sign In").onLast().performClick()
        compose.onAllNodesWithText("Email address is required.").onFirst().assertExists()
        compose.onNodeWithText("Password is required.").assertExists()
        compose.runOnIdle { assertEquals(0, calls) }
    }

    @Test fun catalogSearchShowsEmptyStateAndResetRestoresResults() {
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    ServicesScreen(viewModel = remember { BookingViewModel(FakeBookingGateway()) })
                }
            }
        }
        compose.onNodeWithText("Search services").performScrollTo().performTextInput("nonexistent")
        compose.onNodeWithText("No services found").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Reset and refresh").performScrollTo().performClick()
        compose.onNodeWithText("Design").performScrollTo().assertIsDisplayed()
    }

    @Test fun requestCancellationRequiresConfirmationAndCanBeDismissed() {
        val repo = FakeBookingGateway()
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    BookedRequestsScreen(initialRequestId = "request",
                        viewModel = remember { RequestsViewModel(repo) })
                }
            }
        }
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Cancel request"))
        compose.onNodeWithText("Cancel request").performClick()
        compose.onNodeWithText("Cancel this request?").assertIsDisplayed()
        compose.onNodeWithText("Keep request").performClick()
        compose.onNodeWithText("Cancel this request?").assertDoesNotExist()
        compose.runOnIdle { assertEquals(0, repo.cancellations) }
        compose.onNodeWithText("Cancel request").performClick()
        compose.onNode(hasText("Cancel request") and hasAnyAncestor(isDialog())).performClick()
        compose.runOnIdle { assertEquals(1, repo.cancellations) }
    }

    @Test fun compactProfileShowsFallbacksAndScrollsToLogout() {
        var logouts = 0
        compose.setContent {
            MaterialTheme {
                Box(Modifier.requiredSize(320.dp, 480.dp)) {
                    CompositionLocalProvider(LocalNexusLayout provides NexusLayout(narrow = true, short = true)) {
                        ProfileScreen(user, {}, { logouts++ }, false)
                    }
                }
            }
        }
        compose.onNodeWithText("My account").assertIsDisplayed()
        compose.onNodeWithText("mobile@example.com").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Not provided").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Client").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Log out").performScrollTo().performClick()
        compose.runOnIdle { assertEquals(1, logouts) }
    }

    @Test fun profileBackInvokesNavigation() {
        var backs = 0
        compose.setContent { MaterialTheme { ProfileScreen(user, { backs++ }, {}, false) } }
        compose.onNodeWithText("Back").performClick()
        compose.runOnIdle { assertEquals(1, backs) }
    }

    @Test fun logoutInProgressDisablesBackAndLogout() {
        compose.setContent { MaterialTheme { ProfileScreen(user, {}, {}, true) } }
        compose.onNodeWithText("Back").assertIsNotEnabled()
        compose.onAllNodes(hasClickAction()).assertCountEquals(2)
        compose.onAllNodes(hasClickAction()).fetchSemanticsNodes().indices.forEach { index ->
            compose.onAllNodes(hasClickAction())[index].assertIsNotEnabled()
        }
    }

    @Test fun compactLandscapeTabsDispatchEveryDestination() {
        val selected = mutableListOf<BottomTab>()
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusLayout provides NexusLayout(short = true)) {
                    Box(Modifier.requiredSize(640.dp, 64.dp)) {
                        NexusBottomBar(BottomTab.DASHBOARD, { selected += it })
                    }
                }
            }
        }
        BottomTab.entries.forEach { compose.onNodeWithText(it.label).assertIsDisplayed().performClick() }
        compose.runOnIdle { assertEquals(BottomTab.entries.toList(), selected) }
    }

    @Test fun loadingPrimaryActionRejectsRepeatedTaps() {
        var clicks = 0
        compose.setContent { MaterialTheme { NexusButton("Submit", { clicks++ }, loading = true) } }
        compose.onNode(hasClickAction()).assertIsNotEnabled().performClick()
        compose.runOnIdle { assertEquals(0, clicks) }
    }
}
