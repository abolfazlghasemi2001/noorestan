package com.noorestan.app.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.noorestan.app.ui.viewmodel.HomeViewModel

@Composable
fun HomeScreen(
    onOpenQuran: () -> Unit,
    onOpenEbadat: () -> Unit,
    onOpenPlay: () -> Unit,
    onOpenOnline: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenAdmin: () -> Unit,
    onOpenNotif: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) { viewModel.connect() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("نورستان", style = MaterialTheme.typography.headlineLarge)
        Text(
            text = if (state.connected) "متصل به سرور — ${state.online} نفر آنلاین" else "در حال اتصال…",
            style = MaterialTheme.typography.bodyMedium
        )
        Text("کاربر: ${state.user?.name ?: "مهمان"}", style = MaterialTheme.typography.bodyMedium)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onOpenQuran) { Text("قرآن") }
            Button(onClick = onOpenEbadat) { Text("عبادت") }
            Button(onClick = onOpenPlay) { Text("بازی") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onOpenOnline) { Text("محفل") }
            Button(onClick = onOpenProfile) { Text("حساب من") }
            Button(onClick = onOpenAdmin) { Text("مدیر") }
        }
        Button(onClick = onOpenNotif) { Text("اعلان‌ها") }

        Card(modifier = Modifier.padding(top = 8.dp)) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("روم‌ها: ${state.roomsCount}", style = MaterialTheme.typography.bodyMedium)
                Text("لیدربورد: ${state.leaderboardCount}", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
