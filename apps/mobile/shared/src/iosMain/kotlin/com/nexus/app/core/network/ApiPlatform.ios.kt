package com.nexus.app.core.network

// iOS Simulator shares the host machine's localhost.
actual fun defaultApiBaseUrl(): String = "http://localhost:3001"
