package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.noorestan.app.domain.model.ChatMessage
import com.noorestan.app.domain.repository.MahfelRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RoomViewModel @Inject constructor(
    private val mahfel: MahfelRepository
) : ViewModel() {
    val chat: StateFlow<List<ChatMessage>> = mahfel.chat()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val connected: StateFlow<Boolean> = mahfel.isConnected
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    fun send(text: String) = viewModelScope.launch { if (text.isNotBlank()) mahfel.sendChat(text) }
    fun leave() = viewModelScope.launch { mahfel.leaveRoom() }
    fun startGame(game: String? = null) = viewModelScope.launch { mahfel.startGame(game, false) }
    fun sendMove(index: Int) = viewModelScope.launch { mahfel.sendMove(index) }
}
