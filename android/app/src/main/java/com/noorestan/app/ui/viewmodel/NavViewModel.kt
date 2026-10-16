package com.noorestan.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import com.noorestan.app.core.datastore.SettingsStore
import com.noorestan.app.data.local.preferences.AuthTokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class NavViewModel @Inject constructor(
    val settingsStore: SettingsStore,
    val tokenStore: AuthTokenStore
) : ViewModel()
