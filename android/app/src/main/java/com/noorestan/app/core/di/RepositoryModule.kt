package com.noorestan.app.core.di

import com.noorestan.app.data.repository.AuthRepositoryImpl
import com.noorestan.app.data.repository.HealthRepositoryImpl
import com.noorestan.app.data.remote.ws.MahfelWebSocket
import com.noorestan.app.domain.repository.AuthRepository
import com.noorestan.app.domain.repository.HealthRepository
import com.noorestan.app.domain.repository.MahfelRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindHealth(impl: HealthRepositoryImpl): HealthRepository

    @Binds
    @Singleton
    abstract fun bindAuth(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindMahfel(impl: MahfelWebSocket): MahfelRepository
}
