package com.nexus.app.navigation

import android.content.Context
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.NavGraph
import androidx.navigation.NavGraphNavigator
import androidx.navigation.Navigator
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/** Exercise real Navigation saved stacks, not mocked reset callbacks. */
@RunWith(AndroidJUnit4::class)
class SessionNavigationTest {
    @Test
    fun repeatedTabSelectionDoesNotDuplicateBackStackEntries() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val controller = controller()
            repeat(3) { controller.switchTab(Routes.SERVICES) }
            assertEquals(Routes.SERVICES, controller.currentDestination?.route)
            controller.popBackStack()
            assertEquals(Routes.DASHBOARD, controller.currentDestination?.route)
        }
    }

    @Test
    fun loginResetPreventsBackNavigationIntoProtectedScreens() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val controller = controller()
            controller.switchTab(Routes.SERVICES)
            controller.navigate(Routes.PROFILE)
            controller.resetTo(Routes.LOGIN)
            assertEquals(Routes.LOGIN, controller.currentDestination?.route)
            assertNull(controller.previousBackStackEntry)
        }
    }

    @Navigator.Name("session-test")
    private class SessionTestNavigator : Navigator<NavDestination>() {
        override fun createDestination() = NavDestination(this)
    }

    private fun controller(): NavController {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val controller = NavController(context)
        controller.setViewModelStore(ViewModelStore())
        val owner = object : LifecycleOwner {
            override val lifecycle = LifecycleRegistry(this).apply { currentState = Lifecycle.State.RESUMED }
        }
        controller.setLifecycleOwner(owner)
        val navigator = SessionTestNavigator()
        controller.navigatorProvider.addNavigator(navigator)
        val graph = NavGraph(NavGraphNavigator(controller.navigatorProvider))
        graph.route = "session-graph"
        (Routes.main + Routes.LOGIN + Routes.CHECKING).forEach { route ->
            graph.addDestination(navigator.createDestination().apply { this.route = route })
        }
        graph.setStartDestination(Routes.DASHBOARD)
        controller.graph = graph
        return controller
    }

    @Test
    fun logoutDiscardsSavedDraftAndHistoryBeforeAnotherAccountSignsIn() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val controller = controller()
            controller.switchTab(Routes.SERVICES)
            controller.getBackStackEntry(Routes.SERVICES).savedStateHandle["draft"] = "Account A private draft"
            controller.switchTab(Routes.BOOKED_REQUESTS)
            controller.getBackStackEntry(Routes.BOOKED_REQUESTS).savedStateHandle["history"] = "Account A history"
            controller.switchTab(Routes.DASHBOARD)

            // Both tabs really do restore before ending the session.
            controller.switchTab(Routes.SERVICES)
            assertEquals("Account A private draft",
                controller.getBackStackEntry(Routes.SERVICES).savedStateHandle.get<String>("draft"))
            controller.resetTo(Routes.LOGIN)
            assertFalse(controller.clearBackStack(Routes.SERVICES))
            assertFalse(controller.clearBackStack(Routes.BOOKED_REQUESTS))
            controller.resetTo(Routes.DASHBOARD)
            controller.switchTab(Routes.SERVICES)
            assertNull(controller.getBackStackEntry(Routes.SERVICES).savedStateHandle.get<String>("draft"))
            controller.switchTab(Routes.BOOKED_REQUESTS)
            assertNull(controller.getBackStackEntry(Routes.BOOKED_REQUESTS).savedStateHandle.get<String>("history"))
        }
    }

    @Test
    fun freshSignInCannotRestoreAnOldSavedTabEvenWithoutAnExplicitLogout() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val controller = controller()
            controller.switchTab(Routes.SERVICES)
            controller.getBackStackEntry(Routes.SERVICES).savedStateHandle["draft"] = "Previous account"
            controller.switchTab(Routes.DASHBOARD)
            controller.resetTo(Routes.DASHBOARD)
            controller.switchTab(Routes.SERVICES)
            assertNull(controller.getBackStackEntry(Routes.SERVICES).savedStateHandle.get<String>("draft"))
        }
    }

    @Test
    fun retryingTheSameSessionKeepsItsExistingDraft() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val controller = controller()
            controller.switchTab(Routes.SERVICES)
            controller.getBackStackEntry(Routes.SERVICES).savedStateHandle["draft"] = "Unsubmitted project"
            controller.navigate(Routes.CHECKING)
            controller.restoreAuthenticatedDestination()
            assertEquals(Routes.SERVICES, controller.currentDestination?.route)
            assertEquals("Unsubmitted project",
                controller.getBackStackEntry(Routes.SERVICES).savedStateHandle.get<String>("draft"))
        }
    }

}
