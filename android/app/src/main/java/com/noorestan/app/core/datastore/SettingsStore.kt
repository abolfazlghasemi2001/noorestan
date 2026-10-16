package com.noorestan.app.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "noorestan_settings")

@Singleton
class SettingsStore @Inject constructor(@ApplicationContext private val context: Context) {
    private val darkTheme = booleanPreferencesKey("dark_theme")
    private val onboardingDone = booleanPreferencesKey("onboarding_done")
    private val serverUrl = stringPreferencesKey("server_url")

    val darkThemeFlow: Flow<Boolean> = context.dataStore.data.map { it[darkTheme] ?: false }
    val onboardingDoneFlow: Flow<Boolean> = context.dataStore.data.map { it[onboardingDone] ?: false }
    val serverUrlFlow: Flow<String> = context.dataStore.data.map { it[serverUrl] ?: "" }

    suspend fun setDarkTheme(value: Boolean) {
        context.dataStore.edit { it[darkTheme] = value }
    }
    suspend fun setOnboardingDone(value: Boolean) {
        context.dataStore.edit { it[onboardingDone] = value }
    }
    suspend fun setServerUrl(value: String) {
        context.dataStore.edit { it[serverUrl] = value }
    }
}
