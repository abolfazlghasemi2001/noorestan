package com.noorestan.app.ui.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.noorestan.app.ui.viewmodel.ProfileViewModel

@Composable
fun ProfileScreen(onBack: () -> Unit, viewModel: ProfileViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("حساب من", style = MaterialTheme.typography.headlineLarge)
        Text("نام: ${state.userName}", style = MaterialTheme.typography.bodyLarge)
        state.phone?.let { Text("شماره: $it", style = MaterialTheme.typography.bodyMedium) }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("تم تیره")
            Switch(checked = state.darkTheme, onCheckedChange = { viewModel.setDarkTheme(it) })
        }

        Spacer(Modifier.height(8.dp))
        Button(onClick = { viewModel.logout(); onBack() }) { Text("خروج از حساب") }
        Button(onClick = onBack) { Text("بازگشت") }
    }
}
