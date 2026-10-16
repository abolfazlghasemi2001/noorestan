package com.noorestan.app.ui.screens.quran

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun QuranScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("تلاوت قرآن", style = MaterialTheme.typography.headlineLarge)
        Text("پخش آیه‌به‌آیه با قاری دلخواه (نسخهٔ اولیه)", style = MaterialTheme.typography.bodyMedium)
    }
}
