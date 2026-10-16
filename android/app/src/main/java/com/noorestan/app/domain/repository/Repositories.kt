package com.noorestan.app.domain.repository

import com.noorestan.app.core.common.Result
import com.noorestan.app.domain.model.*
import kotlinx.coroutines.flow.Flow

interface HealthRepository {
    suspend fun check(): Result<String>
}

interface AuthRepository {
    suspend fun requestOtp(phone: String): Result<String>
    suspend fun verifyOtp(phone: String, code: String): Result<User>
    fun currentUser(): Flow<User?>
    suspend fun logout()
}

interface MahfelRepository {
    fun peers(): Flow<List<Peer>>
    fun rooms(): Flow<List<Room>>
    fun leaderboard(): Flow<List<LeaderboardEntry>>
    fun chat(): Flow<List<ChatMessage>>
    suspend fun connect(name: String, level: Int, score: Int, userToken: String?)
    suspend fun disconnect()
    suspend fun createRoom(name: String, game: String)
    suspend fun joinRoom(code: String)
    suspend fun spectateRoom(code: String)
    suspend fun leaveRoom()
    suspend fun startGame(game: String? = null, force: Boolean = false)
    suspend fun sendChat(text: String)
    suspend fun sendMove(index: Int)
    suspend fun submitEsmfamil(answer: String)
    suspend fun nextEsmfamil()
    suspend fun sendReaction(emoji: String)
    suspend fun sendFriendRequest(toId: String)
    suspend fun acceptFriend(toId: String)
    suspend fun declineFriend(toId: String)
    suspend fun putScore(score: Int)
    val isConnected: Flow<Boolean>
}
