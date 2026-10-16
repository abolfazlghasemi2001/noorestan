package com.noorestan.app.data.remote.api

import com.noorestan.app.data.remote.dto.*
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface NoorestanApi {
    @GET("api/health")
    suspend fun health(): HealthResponse

    @GET("api/otp/status")
    suspend fun otpStatus(): OtpStatusResponse

    @POST("api/otp/request")
    suspend fun otpRequest(@Body body: OtpRequest): OtpResponse

    @POST("api/otp/verify")
    suspend fun otpVerify(@Body body: OtpVerifyRequest): OtpResponse

    @POST("api/account/me")
    suspend fun accountMe(@Body body: AccountMeRequest): AccountMeResponse

    @POST("api/account/logout")
    suspend fun accountLogout(@Body body: AccountMeRequest): AccountMeResponse

    @GET("api/coins")
    suspend fun coins(@Header("Authorization") bearer: String): CoinsResponse

    @GET("api/leaderboard")
    suspend fun leaderboard(@Header("Authorization") bearer: String): List<LeaderboardEntry>

    @GET("api/rooms")
    suspend fun rooms(@Header("Authorization") bearer: String): RoomsResponse

    @POST("api/admin/login")
    suspend fun adminLogin(@Body body: AdminLoginRequest): AdminLoginResponse

    @POST("api/admin/whoami")
    suspend fun adminWhoami(@Body body: AdminWhoamiRequest): AdminWhoamiResponse

    @GET("api/stats")
    suspend fun stats(@Header("X-Admin-Token") token: String): StatsResponse
}
