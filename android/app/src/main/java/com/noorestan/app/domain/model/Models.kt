package com.noorestan.app.domain.model

data class User(
    val id: String,
    val phone: String? = null,
    val name: String = "بازیکن",
    val score: Int = 0,
    val level: Int = 1,
    val coins: Int = 0
)

data class Room(
    val code: String,
    val name: String,
    val game: String = "dooz",
    val hostId: String? = null,
    val members: Int = 0,
    val maxMembers: Int = 8
)

data class LeaderboardEntry(
    val name: String,
    val uid: String? = null,
    val score: Int = 0
)

data class ChatMessage(
    val from: String,
    val text: String,
    val system: Boolean = false,
    val at: Long = System.currentTimeMillis()
)

data class Peer(
    val id: String,
    val name: String,
    val level: Int = 1,
    val score: Int = 0
)
