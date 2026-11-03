package com.nexus.app.core.config

import kotlin.experimental.ExperimentalNativeApi
import kotlin.native.Platform

@OptIn(ExperimentalNativeApi::class)
actual object BuildInfo {
    actual val isDebug: Boolean get() = Platform.isDebugBinary
}