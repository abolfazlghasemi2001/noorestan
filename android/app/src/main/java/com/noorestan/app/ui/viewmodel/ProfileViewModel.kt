package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.noorestan.app.core.datastore.SettingsStore
import com.noorestan.app.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val userName: String = "مهمان",
    val phone: String? = null,
    val darkTheme: Boolean = false
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val settingsStore: SettingsStore
) : ViewModel() {
    val state: StateFlow<ProfileUiState> = combine(
        authRepository.currentUser(),
        settingsStore.darkThemeFlow
    ) { user, dark ->
        ProfileUiState(
            userName = user?.name ?: "مهمان",
            phone = user?.phone,
            darkTheme = dark
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ProfileUiState())

    fun setDarkTheme(v: Boolean) = viewModelScope.launch { settingsStore.setDarkTheme(v) }
    fun logout() = viewModelScope.launch { authRepository.logout() }
}
