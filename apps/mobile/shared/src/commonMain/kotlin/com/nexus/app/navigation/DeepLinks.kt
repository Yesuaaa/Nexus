package com.nexus.app.navigation

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Platform-neutral deep link inbox. Android's MainActivity (and later an iOS entry point)
 * calls [offer]; AppNavHost consumes the link once the user is signed in.
 */
object DeepLinks {
    private val _pending = MutableStateFlow<String?>(null)
    val pending: StateFlow<String?> = _pending.asStateFlow()

    fun offer(uri: String?) {
        _pending.value = uri
    }

    fun consume() {
        _pending.value = null
    }

    /** nexus://services -> "services". Unknown or profile links return null. */
    fun routeFor(uri: String): String? {
        if (!uri.startsWith("nexus://")) return null
        return when (uri.removePrefix("nexus://").substringBefore('?').substringBefore('/')) {
            "dashboard" -> Routes.DASHBOARD
            "services" -> Routes.SERVICES
            "booked-requests" -> Routes.BOOKED_REQUESTS
            else -> null
        }
    }
}