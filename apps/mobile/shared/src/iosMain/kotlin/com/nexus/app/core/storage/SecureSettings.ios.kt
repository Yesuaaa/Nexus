package com.nexus.app.core.storage

import com.russhwolf.settings.ExperimentalSettingsImplementation
import com.russhwolf.settings.KeychainSettings
import com.russhwolf.settings.Settings

@OptIn(ExperimentalSettingsImplementation::class)
actual fun createSecureSettings(): Settings = KeychainSettings(service = "com.nexus.app")