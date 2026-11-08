package com.nexus.app.core.storage

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.russhwolf.settings.Settings
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class SecureSettingsTest {

    private lateinit var ctx: Context
    private lateinit var settings: Settings

    @Before
    fun setUp() {
        ctx = ApplicationProvider.getApplicationContext()
        // Normally set from NexusApplication.onCreate(); the test app doesn't run that.
        AndroidContextHolder.context = ctx
        settings = createSecureSettings()
        settings.clear()
    }

    @After
    fun tearDown() {
        settings.clear()
    }

    @Test
    fun savedString_canBeReadBack() {
        settings.putString("access_token", "secret123")
        assertEquals("secret123", settings.getStringOrNull("access_token"))
    }

    @Test
    fun missingKey_returnsNull() {
        assertNull(settings.getStringOrNull("does_not_exist"))
    }

    @Test
    fun removedKey_returnsNull() {
        settings.putString("access_token", "secret123")
        settings.remove("access_token")
        assertNull(settings.getStringOrNull("access_token"))
    }

    @Test
    fun value_survivesRecreatingSettings() {
        settings.putString("refresh_token", "persist-me")
        val reopened = createSecureSettings()
        assertEquals("persist-me", reopened.getStringOrNull("refresh_token"))
    }

    @Test
    fun valueOnDisk_isNotPlaintext() {
        settings.putString("access_token", "secret123")

        // SharedPreferences writes asynchronously, so wait for the file to appear.
        val file = File(ctx.applicationInfo.dataDir, "shared_prefs/nexus_secure.xml")
        var waited = 0
        while (!file.exists() && waited < 3000) {
            Thread.sleep(100)
            waited += 100
        }

        assertTrue("nexus_secure.xml was never written", file.exists())
        val raw = file.readText()
        assertFalse("plaintext value found on disk", raw.contains("secret123"))
        assertFalse("plaintext key found on disk", raw.contains("access_token"))
    }
}