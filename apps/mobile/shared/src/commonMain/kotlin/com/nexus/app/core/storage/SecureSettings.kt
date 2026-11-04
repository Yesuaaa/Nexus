package com.nexus.app.core.storage

import com.russhwolf.settings.Settings

/** Android: EncryptedSharedPreferences. iOS: Keychain. */
expect fun createSecureSettings(): Settings