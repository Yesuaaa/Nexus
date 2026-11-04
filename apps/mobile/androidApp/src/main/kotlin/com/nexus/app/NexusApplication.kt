package com.nexus.app

import android.app.Application
import com.nexus.app.core.storage.AndroidContextHolder

class NexusApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AndroidContextHolder.context = applicationContext
    }
}