package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.noorestan.app.domain.model.Peer
import com.noorestan.app.domain.model.Room
import com.noorestan.app.domain.repository.MahfelRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OnlineUiState(
    val connected: Boolean = false,
    val peers: List<Peer> = emptyList(),
    val rooms: List<Room> = emptyList(),
    val leaderboardSize: Int = 0
)

@HiltViewModel
class OnlineViewModel @Inject constructor(
    private val mahfel: MahfelRepository
) : ViewModel() {
    val state: StateFlow<OnlineUiState> = combine(
        mahfel.isConnected,
        mahfel.peers(),
        mahfel.rooms(),
        mahfel.leaderboard()
    ) { connected, peers, rooms, lb ->
        OnlineUiState(connected, peers, rooms, lb.size)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), OnlineUiState())

    fun createRoom(name: String, game: String) = viewModelScope.launch { mahfel.createRoom(name, game) }
    fun joinRoom(code: String) = viewModelScope.launch { mahfel.joinRoom(code) }
    fun spectate(code: String) = viewModelScope.launch { mahfel.spectateRoom(code) }
}
