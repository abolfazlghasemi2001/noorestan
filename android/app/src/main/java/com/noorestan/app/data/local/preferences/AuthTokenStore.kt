package com.noorestan.app.data.local.preferences

import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthTokenStore @Inject constructor(private val prefs: SharedPreferences) {
    fun getUserToken(): String? = prefs.getString("user_token", null)
    fun setUserToken(token: String?) {
        prefs.edit().apply {
            if (token == null) remove("user_token") else putString("user_token", token)
        }.apply()
    }
    fun getAdminToken(): String? = prefs.getString("admin_token", null)
    fun setAdminToken(token: String?) {
        prefs.edit().apply {
            if (token == null) remove("admin_token") else putString("admin_token", token)
        }.apply()
    }
    fun getPhone(): String? = prefs.getString("phone", null)
    fun setPhone(phone: String?) {
        prefs.edit().apply {
            if (phone == null) remove("phone") else putString("phone", phone)
        }.apply()
    }
    fun getUserId(): String? = prefs.getString("user_id", null)
    fun setUserId(id: String?) {
        prefs.edit().apply {
            if (id == null) remove("user_id") else putString("user_id", id)
        }.apply()
    }
    fun getUserName(): String? = prefs.getString("user_name", null)
    fun setUserName(name: String?) {
        prefs.edit().apply {
            if (name == null) remove("user_name") else putString("user_name", name)
        }.apply()
    }
    fun clear() {
        prefs.edit().clear().apply()
    }
}
