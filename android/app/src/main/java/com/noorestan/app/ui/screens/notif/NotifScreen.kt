package com.noorestan.app.ui.screens.notif

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun NotifScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("اعلان‌ها", style = MaterialTheme.typography.headlineLarge)
        Text("اعلانی موجود نیست", style = MaterialTheme.typography.bodyMedium)
    }
}
