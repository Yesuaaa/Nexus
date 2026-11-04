package com.nexus.app.core.config

import android.content.pm.ApplicationInfo
import com.nexus.app.core.storage.AndroidContextHolder

actual object BuildInfo {
    // Returns false when no Application context exists (e.g. unit tests).
    actual val isDebug: Boolean
        get() = runCatching {
            (AndroidContextHolder.context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        }.getOrDefault(false)
}