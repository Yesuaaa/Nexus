package com.nexus.app.core.storage

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.russhwolf.settings.Settings
import com.russhwolf.settings.SharedPreferencesSettings

/** Set once from NexusApplication.onCreate(). */
object AndroidContextHolder {
    lateinit var context: Context
}

actual fun createSecureSettings(): Settings {
    val ctx = AndroidContextHolder.context
    val prefs = EncryptedSharedPreferences.create(
        ctx,
        "nexus_secure",
        MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
    return SharedPreferencesSettings(prefs)
}