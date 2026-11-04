package com.nexus.app.core.network

// Initialized by NexusApplication before the shared HTTP client is created.
var androidApiBaseUrl: String = "http://10.0.2.2:3001"

actual fun defaultApiBaseUrl(): String = androidApiBaseUrl
