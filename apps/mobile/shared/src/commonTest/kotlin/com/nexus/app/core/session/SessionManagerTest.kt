package com.nexus.app.core.session

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SessionManagerTest {

    @Test
    fun startsSignedOutWithNoNotice() {
        val session = SessionManager()
        assertNull(session.user.value)
        assertNull(session.notice.value)
    }

    @Test
    fun expire_clearsUserAndSetsNotice() {
        val session = SessionManager()
        session.expire()
        assertNull(session.user.value)
        assertEquals("Your session expired. Please sign in again.", session.notice.value)
    }

    @Test
    fun clear_withoutNotice_resetsNotice() {
        val session = SessionManager()
        session.expire()
        session.clear()
        assertNull(session.notice.value)
    }

    @Test
    fun clear_withNotice_keepsMessage() {
        val session = SessionManager()
        session.clear("Signed out on this device")
        assertEquals("Signed out on this device", session.notice.value)
    }
}