package com.noorestan.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.noorestan.app.ui.screens.admin.AdminScreen
import com.noorestan.app.ui.screens.auth.AuthScreen
import com.noorestan.app.ui.screens.ebadat.EbadatScreen
import com.noorestan.app.ui.screens.health.HealthScreen
import com.noorestan.app.ui.screens.home.HomeScreen
import com.noorestan.app.ui.screens.notif.NotifScreen
import com.noorestan.app.ui.screens.onboarding.OnboardingScreen
import com.noorestan.app.ui.screens.online.OnlineScreen
import com.noorestan.app.ui.screens.play.PlayScreen
import com.noorestan.app.ui.screens.profile.ProfileScreen
import com.noorestan.app.ui.screens.quran.QuranScreen
import com.noorestan.app.ui.screens.room.RoomScreen
import com.noorestan.app.ui.viewmodel.NavViewModel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

@Composable
fun NoorestanNavHost() {
    val navViewModel: NavViewModel = hiltViewModel()
    val settings = navViewModel.settingsStore
    val tokenStore = navViewModel.tokenStore

    val onboardingDone = runBlocking { settings.onboardingDoneFlow.first() }
    val hasToken = tokenStore.getUserToken() != null

    val start = when {
        !onboardingDone -> Routes.ONBOARDING
        !hasToken -> Routes.HEALTH
        else -> Routes.HOME
    }

    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = start) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(onFinish = {
                runBlocking { settings.setOnboardingDone(true) }
                navController.navigate(Routes.HEALTH) { popUpTo(Routes.ONBOARDING) { inclusive = true } }
            })
        }
        composable(Routes.HEALTH) {
            HealthScreen(onContinue = {
                if (tokenStore.getUserToken() != null) {
                    navController.navigate(Routes.HOME) { popUpTo(Routes.HEALTH) { inclusive = true } }
                } else {
                    navController.navigate(Routes.AUTH) { popUpTo(Routes.HEALTH) { inclusive = true } }
                }
            })
        }
        composable(Routes.AUTH) {
            AuthScreen(onSuccess = {
                navController.navigate(Routes.HOME) { popUpTo(Routes.AUTH) { inclusive = true } }
            })
        }
        composable(Routes.HOME) {
            HomeScreen(
                onOpenQuran = { navController.navigate(Routes.QURAN) },
                onOpenEbadat = { navController.navigate(Routes.EBADAT) },
                onOpenPlay = { navController.navigate(Routes.PLAY) },
                onOpenOnline = { navController.navigate(Routes.ONLINE) },
                onOpenProfile = { navController.navigate(Routes.PROFILE) },
                onOpenAdmin = { navController.navigate(Routes.ADMIN) },
                onOpenNotif = { navController.navigate(Routes.NOTIF) }
            )
        }
        composable(Routes.QURAN) { QuranScreen(onBack = { navController.popBackStack() }) }
        composable(Routes.EBADAT) { EbadatScreen(onBack = { navController.popBackStack() }) }
        composable(Routes.PLAY) { PlayScreen(onBack = { navController.popBackStack() }) }
        composable(Routes.ONLINE) {
            OnlineScreen(onOpenRoom = { code -> navController.navigate("room/$code") })
        }
        composable(
            route = Routes.ROOM,
            arguments = listOf(navArgument("code") { type = NavType.StringType })
        ) { backStack ->
            val code = backStack.arguments?.getString("code") ?: ""
            RoomScreen(code = code, onBack = { navController.popBackStack() })
        }
        composable(Routes.PROFILE) { ProfileScreen(onBack = { navController.popBackStack() }) }
        composable(Routes.ADMIN) { AdminScreen(onBack = { navController.popBackStack() }) }
        composable(Routes.NOTIF) { NotifScreen(onBack = { navController.popBackStack() }) }
    }
}
