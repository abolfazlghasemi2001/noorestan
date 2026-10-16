package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.noorestan.app.core.common.Result
import com.noorestan.app.core.common.UiState
import com.noorestan.app.data.local.preferences.AuthTokenStore
import com.noorestan.app.data.remote.api.NoorestanApi
import com.noorestan.app.data.remote.dto.AdminLoginRequest
import com.noorestan.app.data.remote.dto.AdminWhoamiRequest
import com.noorestan.app.data.remote.dto.StatsResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AdminViewModel @Inject constructor(
    private val api: NoorestanApi,
    private val tokenStore: AuthTokenStore
) : ViewModel() {
    private val _pass = MutableStateFlow("")
    val pass: StateFlow<String> = _pass.asStateFlow()

    private val _state = MutableStateFlow<UiState<StatsResponse>>(UiState.Idle)
    val state: StateFlow<UiState<StatsResponse>> = _state.asStateFlow()

    private val _loggedIn = MutableStateFlow(tokenStore.getAdminToken() != null)
    val loggedIn: StateFlow<Boolean> = _loggedIn.asStateFlow()

    fun setPass(v: String) { _pass.value = v }

    fun login() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            try {
                val res = api.adminLogin(AdminLoginRequest(_pass.value))
                if (res.success && res.token != null) {
                    tokenStore.setAdminToken(res.token)
                    _loggedIn.value = true
                    loadStats()
                } else {
                    _state.value = UiState.Error(res.error ?: "ورود ناموفق")
                }
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message ?: "خطا")
            }
        }
    }

    fun loadStats() {
        val token = tokenStore.getAdminToken() ?: return
        _state.value = UiState.Loading
        viewModelScope.launch {
            try {
                val res = api.stats(token)
                _state.value = UiState.Success(res)
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message ?: "خطا")
            }
        }
    }

    fun logout() {
        val token = tokenStore.getAdminToken()
        tokenStore.setAdminToken(null)
        _loggedIn.value = false
        _state.value = UiState.Idle
    }
}
