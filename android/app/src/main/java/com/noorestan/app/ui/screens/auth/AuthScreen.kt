package com.noorestan.app.ui.screens.auth

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.noorestan.app.core.common.UiState
import com.noorestan.app.ui.components.ErrorView
import com.noorestan.app.ui.components.LoadingView
import com.noorestan.app.ui.viewmodel.AuthViewModel

@Composable
fun AuthScreen(onSuccess: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    val phone by viewModel.phone.collectAsState()
    val code by viewModel.code.collectAsState()
    val state by viewModel.state.collectAsState()
    val otpSent by viewModel.otpSent.collectAsState()

    LaunchedEffect(state) {
        if (state is UiState.Success) onSuccess()
    }

    when (state) {
        UiState.Loading -> LoadingView()
        is UiState.Error -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(state.message, color = MaterialTheme.colorScheme.error)
            Spacer(Modifier.height(12.dp))
            Button(onClick = { viewModel.requestOtp() }) { Text("تلاش مجدد") }
        }
        else -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("ورود / ثبت‌نام", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = phone,
                onValueChange = { viewModel.setPhone(it) },
                label = { Text("شماره موبایل") },
                singleLine = true
            )
            Spacer(Modifier.height(8.dp))
            if (otpSent) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { viewModel.setCode(it) },
                    label = { Text("کد تأیید") },
                    singleLine = true
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = { viewModel.verify() }) { Text("تأیید") }
            } else {
                Button(onClick = { viewModel.requestOtp() }) { Text("ارسال کد") }
            }
        }
    }
}
