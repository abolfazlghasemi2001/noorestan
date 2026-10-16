package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.noorestan.app.domain.model.User
import com.noorestan.app.data.local.preferences.AuthTokenStore
import com.noorestan.app.domain.repository.AuthRepository
import com.noorestan.app.domain.repository.MahfelRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val user: User? = null,
    val online: Int = 0,
    val roomsCount: Int = 0,
    val leaderboardCount: Int = 0,
    val connected: Boolean = false
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val mahfelRepository: MahfelRepository,
    private val tokenStore: AuthTokenStore
) : ViewModel() {
    val state: StateFlow<HomeUiState> = combine(
        authRepository.currentUser(),
        mahfelRepository.isConnected,
        mahfelRepository.peers(),
        mahfelRepository.rooms(),
        mahfelRepository.leaderboard()
    ) { user, connected, peers, rooms, lb ->
        HomeUiState(
            user = user,
            online = peers.size,
            roomsCount = rooms.size,
            leaderboardCount = lb.size,
            connected = connected
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), HomeUiState())

    fun connect() {
        viewModelScope.launch {
            val user = authRepository.currentUser().first() as? com.noorestan.app.domain.model.User
            mahfelRepository.connect(
                name = user?.name ?: (tokenStore.getUserName() ?: "بازیکن"),
                level = user?.level ?: 1,
                score = user?.score ?: 0,
                userToken = tokenStore.getUserToken()
            )
        }
    }
}
