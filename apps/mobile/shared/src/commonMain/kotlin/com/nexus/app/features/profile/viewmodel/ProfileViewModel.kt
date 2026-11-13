package com.nexus.app.features.profile.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.files.SelectedFile
import com.nexus.app.core.session.SessionManager
import com.nexus.app.features.profile.api.ProfileRepository
import com.nexus.app.features.profile.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProfileState(
    val profile: Profile? = null, val settings: AccountSettings? = null,
    val loading: Boolean = true, val busy: Boolean = false,
    val error: String? = null, val message: String? = null
)
class ProfileViewModel(private val repository: ProfileRepository, private val session: SessionManager) : ViewModel() {
    private val mutable = MutableStateFlow(ProfileState())
    val state = mutable.asStateFlow()
    private val generation = session.generation
    init { reload() }
    fun reload() {
        viewModelScope.launch {
            mutable.value = mutable.value.copy(loading = true, error = null)
            try {
                val profile = repository.profile()
                if (session.generation != generation) return@launch
                session.updateUser(profile.user, generation)
                mutable.value = mutable.value.copy(profile = profile)
                mutable.value = mutable.value.copy(settings = repository.settings())
            } catch (e: CancellationException) { throw e }
              catch (e: Exception) { mutable.value = mutable.value.copy(error = e.message ?: "Unable to load account. Please retry.") }
            finally { mutable.value = mutable.value.copy(loading = false) }
        }
    }
    private fun mutate(message: String, done: () -> Unit = {}, block: suspend () -> Unit) {
        if (mutable.value.busy) return
        mutable.value = mutable.value.copy(busy = true, error = null, message = null)
        viewModelScope.launch {
            try {
                if (session.generation != generation) return@launch
                block()
                if (session.generation != generation) return@launch
                mutable.value = mutable.value.copy(message = message)
                done()
            } catch (e: CancellationException) { throw e }
              catch (e: Exception) { mutable.value = mutable.value.copy(error = e.message ?: "Unable to save. Please retry.") }
            finally { mutable.value = mutable.value.copy(busy = false) }
        }
    }
    private fun apply(profile: Profile) {
        if (session.generation != generation) return
        mutable.value = mutable.value.copy(profile = profile)
        session.updateUser(profile.user, generation)
    }
    fun save(name: String, contact: String, done: () -> Unit) = mutate("Personal details saved", done) {
        apply(repository.save(PersonalDetails(name.trim(), contact.trim())))
    }
    fun images(avatar: SelectedFile?, banner: SelectedFile?, applied: (String) -> Unit, done: () -> Unit) = mutate("Profile images saved", done) {
        // Clear each successfully uploaded draft so a later failure can be retried independently.
        if (avatar != null) { apply(repository.upload("avatar", avatar)); applied("avatar") }
        if (banner != null) { apply(repository.upload("banner", banner)); applied("banner") }
    }
    fun password(current: String, next: String, done: () -> Unit) = mutate("Password updated", done) {
        repository.password(PasswordChange(current, next))
    }
    fun preferences(value: Preferences) = mutate("Preferences saved") {
        val saved = repository.preferences(value)
        mutable.value = mutable.value.copy(settings = mutable.value.settings?.copy(preferences = saved))
    }
    fun revoke(id: String? = null) = mutate("Sessions updated") {
        if (id == null) repository.revokeOthers() else repository.revoke(id)
        mutable.value = mutable.value.copy(settings = repository.settings())
    }
    fun clearFeedback() { mutable.value = mutable.value.copy(error = null, message = null) }
}
