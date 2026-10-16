package com.noorestan.app.core.common

sealed interface Result<out T> {
    data class Success<T>(val data: T) : Result<T>
    data class Error(val message: String, val code: Int? = null, val cause: Throwable? = null) : Result<Nothing>
    data object Loading : Result<Nothing>
}
