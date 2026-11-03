package com.nexus.app.navigation

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DeepLinksTest {

    @Test
    fun mapsKnownLinksToRoutes() {
        assertEquals(Routes.DASHBOARD, DeepLinks.routeFor("nexus://dashboard"))
        assertEquals(Routes.SERVICES, DeepLinks.routeFor("nexus://services"))
        assertEquals(Routes.BOOKED_REQUESTS, DeepLinks.routeFor("nexus://booked-requests"))
    }

    @Test
    fun ignoresTrailingSlashAndQuery() {
        assertEquals(Routes.SERVICES, DeepLinks.routeFor("nexus://services/"))
        assertEquals(Routes.SERVICES, DeepLinks.routeFor("nexus://services?ref=email"))
    }

    @Test
    fun rejectsUnknownOrForeignLinks() {
        assertNull(DeepLinks.routeFor("nexus://profile"))
        assertNull(DeepLinks.routeFor("https://example.com/services"))
        assertNull(DeepLinks.routeFor("nexus://"))
    }

    @Test
    fun offerAndConsume() {
        DeepLinks.offer("nexus://services")
        assertEquals("nexus://services", DeepLinks.pending.value)
        DeepLinks.consume()
        assertNull(DeepLinks.pending.value)
    }
}