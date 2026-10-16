package com.noorestan.app.data.repository

import com.noorestan.app.core.common.Result
import com.noorestan.app.data.remote.api.NoorestanApi
import com.noorestan.app.domain.repository.HealthRepository
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HealthRepositoryImpl @Inject constructor(
    private val api: NoorestanApi
) : HealthRepository {
    override suspend fun check(): Result<String> {
        return try {
            val res = api.health()
            if (res.ok && res.service == "noorestan") {
                Result.Success("noorestan")
            } else {
                Result.Error("پاسخ نامعتبر از سرور")
            }
        } catch (e: SocketTimeoutException) {
            Result.Error("مهلت اتصال به پایان رسید (Timeout)")
        } catch (e: IOException) {
            Result.Error("اتصال اینترنت برقرار نیست یا سرور در دسترس نیست")
        } catch (e: HttpException) {
            Result.Error("خطای HTTP ${e.code()}: ${e.message()}")
        } catch (e: Exception) {
            val msg = e.message ?: "خطای ناشناخته"
            if (msg.contains("Serialization") || msg.contains("json", ignoreCase = true)) {
                Result.Error("پاسخ JSON نامعتبر است")
            } else {
                Result.Error(msg)
            }
        }
    }
}
