package com.noorestan.app.core.di

import android.content.SharedPreferences
import com.noorestan.app.data.local.preferences.AuthTokenStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideAuthTokenStore(prefs: SharedPreferences): AuthTokenStore = AuthTokenStore(prefs)
}
