package com.noorestan.app.ui.screens.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.noorestan.app.core.common.UiState
import com.noorestan.app.ui.components.ErrorView
import com.noorestan.app.ui.components.LoadingView
import com.noorestan.app.ui.viewmodel.AdminViewModel

@Composable
fun AdminScreen(onBack: () -> Unit, viewModel: AdminViewModel = hiltViewModel()) {
    val pass by viewModel.pass.collectAsState()
    val loggedIn by viewModel.loggedIn.collectAsState()
    val state by viewModel.state.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("پنل مدیریت", style = MaterialTheme.typography.headlineLarge)
        if (!loggedIn) {
            OutlinedTextField(value = pass, onValueChange = { viewModel.setPass(it) }, label = { Text("رمز مدیر") })
            Button(onClick = { viewModel.login() }) { Text("ورود") }
            if (state is UiState.Error) Text((state as UiState.Error).message, color = MaterialTheme.colorScheme.error)
        } else {
            when (val s = state) {
                UiState.Idle -> Button(onClick = { viewModel.loadStats() }) { Text("بارگذاری آمار") }
                UiState.Loading -> LoadingView()
                is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.loadStats() })
                is UiState.Success -> {
                    Text("نسخه: ${s.data.version}")
                    Text("آنلاین: ${s.data.online}")
                    Text("روم‌ها: ${s.data.rooms}")
                    Text("پیک آنلاین: ${s.data.peakOnline}")
                }
                UiState.Empty -> Text("خالی")
            }
            Spacer(Modifier.height(8.dp))
            Button(onClick = { viewModel.logout() }) { Text("خروج مدیر") }
        }
        Button(onClick = onBack) { Text("بازگشت") }
    }
}
