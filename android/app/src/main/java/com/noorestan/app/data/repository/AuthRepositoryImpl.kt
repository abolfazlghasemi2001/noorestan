package com.noorestan.app.data.repository

import com.noorestan.app.core.common.Result
import com.noorestan.app.data.local.preferences.AuthTokenStore
import com.noorestan.app.data.remote.api.NoorestanApi
import com.noorestan.app.data.remote.dto.OtpRequest
import com.noorestan.app.data.remote.dto.OtpVerifyRequest
import com.noorestan.app.domain.model.User
import com.noorestan.app.domain.repository.AuthRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val api: NoorestanApi,
    private val tokenStore: AuthTokenStore
) : AuthRepository {

    private val _user = MutableStateFlow<User?>(null)

    init {
        val token = tokenStore.getUserToken()
        val id = tokenStore.getUserId()
        val name = tokenStore.getUserName()
        if (token != null && id != null) {
            _user.value = User(id = id, name = name ?: "بازیکن")
        }
    }

    override suspend fun requestOtp(phone: String): Result<String> {
        return try {
            val res = api.otpRequest(OtpRequest(phone))
            if (res.success) Result.Success(res.state ?: "sent")
            else Result.Error(res.error ?: "ارسال کد ناموفق بود")
        } catch (e: HttpException) {
            Result.Error("خطای HTTP ${e.code()}")
        } catch (e: IOException) {
            Result.Error("اتصال اینترنت برقرار نیست")
        } catch (e: Exception) {
            Result.Error(e.message ?: "خطای ناشناخته")
        }
    }

    override suspend fun verifyOtp(phone: String, code: String): Result<User> {
        return try {
            val res = api.otpVerify(OtpVerifyRequest(phone, code, tokenStore.getUserId() ?: ""))
            if (res.success && res.token != null && res.id != null) {
                tokenStore.setUserToken(res.token)
                tokenStore.setPhone(phone)
                tokenStore.setUserId(res.id)
                tokenStore.setUserName(res.name ?: "بازیکن")
                val user = User(id = res.id, phone = phone, name = res.name ?: "بازیکن")
                _user.value = user
                Result.Success(user)
            } else {
                Result.Error(res.error ?: "کد تأیید نامعتبر است")
            }
        } catch (e: HttpException) {
            Result.Error("خطای HTTP ${e.code()}")
        } catch (e: IOException) {
            Result.Error("اتصال اینترنت برقرار نیست")
        } catch (e: Exception) {
            Result.Error(e.message ?: "خطای ناشناخته")
        }
    }

    override fun currentUser(): Flow<User?> = _user.asStateFlow()

    override suspend fun logout() {
        val token = tokenStore.getUserToken()
        if (token != null) {
            try { api.accountLogout(com.noorestan.app.data.remote.dto.AccountMeRequest(token)) } catch (_: Exception) {}
        }
        tokenStore.clear()
        _user.value = null
    }
}
