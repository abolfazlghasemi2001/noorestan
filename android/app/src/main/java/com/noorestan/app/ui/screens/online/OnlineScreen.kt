package com.noorestan.app.ui.screens.online

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.noorestan.app.ui.viewmodel.OnlineViewModel

@Composable
fun OnlineScreen(
    onOpenRoom: (String) -> Unit,
    viewModel: OnlineViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    var roomName by remember { mutableStateOf("روم من") }
    var roomCode by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("محفل نور", style = MaterialTheme.typography.headlineLarge)
        Text(if (state.connected) "${state.peers.size} نفر آنلاین" else "در حال اتصال…")
        Text("روم‌ها: ${state.rooms.size}")

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = roomName, onValueChange = { roomName = it }, label = { Text("نام روم") }, modifier = Modifier.weight(1f))
            Button(onClick = { viewModel.createRoom(roomName, "dooz") }) { Text("ساخت") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = roomCode, onValueChange = { roomCode = it }, label = { Text("کد روم") }, modifier = Modifier.weight(1f))
            Button(onClick = { if (roomCode.isNotBlank()) onOpenRoom(roomCode) }) { Text("ورود") }
        }

        Text("فهرست روم‌ها:", style = MaterialTheme.typography.titleMedium)
        state.rooms.forEach { r ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${r.code} - ${r.name} (${r.members}/${r.maxMembers}) ${r.game}")
                Button(onClick = { onOpenRoom(r.code) }) { Text("ورود") }
            }
        }
    }
}
