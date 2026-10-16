package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.noorestan.app.core.common.Result
import com.noorestan.app.core.common.UiState
import com.noorestan.app.domain.repository.HealthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HealthViewModel @Inject constructor(
    private val healthRepository: HealthRepository
) : ViewModel() {
    private val _state = MutableStateFlow<UiState<String>>(UiState.Idle)
    val state: StateFlow<UiState<String>> = _state.asStateFlow()

    fun check() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            when (val r = healthRepository.check()) {
                is Result.Success -> _state.value = UiState.Success(r.data)
                is Result.Error -> _state.value = UiState.Error(r.message)
                Result.Loading -> _state.value = UiState.Loading
            }
        }
    }
}
