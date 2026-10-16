package com.noorestan.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class HealthResponse(val ok: Boolean, val service: String)

@Serializable
data class OtpRequest(val phone: String)

@Serializable
data class OtpVerifyRequest(val phone: String, val code: String, val userId: String = "")

@Serializable
data class OtpResponse(
    val success: Boolean = false,
    val state: String? = null,
    val error: String? = null,
    val pending: Boolean = false,
    val token: String? = null,
    val id: String? = null,
    val name: String? = null,
    val first: Boolean = false,
    val welcomed: Boolean = false,
    val exp: Long? = null,
    val ttl: Long? = null,
    val left: Int? = null,
    val locked: Boolean = false,
    val waitMin: Int? = null,
    val burned: Boolean = false,
    val expired: Boolean = false
)

@Serializable
data class AccountMeRequest(val token: String)

@Serializable
data class AccountMeResponse(val success: Boolean = false, val id: String? = null, val phone: String? = null)

@Serializable
data class CoinsResponse(val success: Boolean = false, val coins: Int = 0, val items: Map<String, Int> = emptyMap(), val enabled: Boolean = false)

@Serializable
data class LeaderboardEntry(
    val id: String? = null,
    val name: String? = null,
    val score: Int = 0,
    val level: Int = 1
)

@Serializable
data class RoomsResponse(val rooms: List<RoomDto> = emptyList())

@Serializable
data class RoomDto(
    val code: String? = null,
    val name: String? = null,
    val game: String? = null,
    val host: String? = null,
    val members: Int = 0
)

@Serializable
data class AdminLoginRequest(val pass: String)

@Serializable
data class AdminLoginResponse(val success: Boolean = false, val token: String? = null, val exp: Long? = null, val error: String? = null)

@Serializable
data class AdminWhoamiRequest(val token: String)

@Serializable
data class AdminWhoamiResponse(val success: Boolean = false, val admin: Boolean = false)

@Serializable
data class StatsResponse(
    val version: String? = null,
    val online: Int = 0,
    val rooms: Int = 0,
    val peakOnline: Int = 0
)

@Serializable
data class OtpStatusResponse(val configured: Boolean = false, val on: Boolean = false, val device: String = "")
