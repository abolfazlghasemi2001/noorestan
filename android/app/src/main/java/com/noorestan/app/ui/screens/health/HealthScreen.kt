package com.noorestan.app.ui.screens.health

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.noorestan.app.core.common.UiState
import com.noorestan.app.ui.components.EmptyView
import com.noorestan.app.ui.components.ErrorView
import com.noorestan.app.ui.components.LoadingView
import com.noorestan.app.ui.viewmodel.HealthViewModel

@Composable
fun HealthScreen(onContinue: () -> Unit, viewModel: HealthViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) { viewModel.check() }
    when (val s = state) {
        UiState.Idle, UiState.Loading -> LoadingView()
        is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.check() })
        is UiState.Success -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(40.dp))
            Text("سرور نورستان در دسترس است", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text("سرویس: ${s.data}", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(24.dp))
            Button(onClick = onContinue) { Text("ادامه") }
        }
        UiState.Empty -> EmptyView("داده‌ای نیست")
    }
}
