package com.noorestan.app.ui.screens.play

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun PlayScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("بازی‌ها", style = MaterialTheme.typography.headlineLarge)
        Text("بازی‌های فکری و مأموریت‌های روزانه (نسخهٔ اولیه)", style = MaterialTheme.typography.bodyMedium)
    }
}
