package com.nexus.app.core.network

/** Platform-specific host used to reach the local Nexus API during development. */
expect fun defaultApiBaseUrl(): String
