package com.nexus.app.features.profile.model

import com.nexus.app.features.auth.model.AuthUser
import kotlinx.serialization.Serializable

@Serializable data class Profile(val user: AuthUser, val imageUrl: String? = null, val bannerUrl: String? = null)
@Serializable data class PersonalDetails(val fullName: String, val contactNumber: String)
@Serializable data class ImageUpload(val kind: String, val dataUrl: String)
@Serializable data class ImageResult(val profile: Profile? = null)
@Serializable data class PasswordChange(val currentPassword: String, val newPassword: String)
@Serializable data class Preferences(
    val timeZone: String = "Asia/Manila",
    val dateFormat: String = "MM/DD/YYYY",
    val timeFormat: String = "12h",
    val workflowNotifications: Boolean = true
)
@Serializable data class AccountSession(
    val id: String, val device: String, val location: String? = null,
    val createdAt: String, val lastActiveAt: String? = null, val current: Boolean
)
@Serializable data class AccountSettings(val preferences: Preferences, val sessions: List<AccountSession>)
