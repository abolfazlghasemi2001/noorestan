package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.noorestan.app.core.common.Result
import com.noorestan.app.core.common.UiState
import com.noorestan.app.domain.model.User
import com.noorestan.app.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()

    private val _code = MutableStateFlow("")
    val code: StateFlow<String> = _code.asStateFlow()

    private val _state = MutableStateFlow<UiState<User>>(UiState.Idle)
    val state: StateFlow<UiState<User>> = _state.asStateFlow()

    private val _otpSent = MutableStateFlow(false)
    val otpSent: StateFlow<Boolean> = _otpSent.asStateFlow()

    fun setPhone(v: String) { _phone.value = v }
    fun setCode(v: String) { _code.value = v }

    fun requestOtp() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            when (val r = authRepository.requestOtp(_phone.value)) {
                is Result.Success -> { _otpSent.value = true; _state.value = UiState.Idle }
                is Result.Error -> _state.value = UiState.Error(r.message)
                Result.Loading -> {}
            }
        }
    }

    fun verify() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            when (val r = authRepository.verifyOtp(_phone.value, _code.value)) {
                is Result.Success -> _state.value = UiState.Success(r.data)
                is Result.Error -> _state.value = UiState.Error(r.message)
                Result.Loading -> {}
            }
        }
    }
}
