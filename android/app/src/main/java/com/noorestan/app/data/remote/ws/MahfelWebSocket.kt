package com.noorestan.app.data.remote.ws

import com.noorestan.app.BuildConfig
import com.noorestan.app.core.common.Result
import com.noorestan.app.core.network.NoorestanApi
import com.noorestan.app.domain.model.ChatMessage
import com.noorestan.app.domain.model.LeaderboardEntry
import com.noorestan.app.domain.model.Peer
import com.noorestan.app.domain.model.Room
import com.noorestan.app.domain.repository.MahfelRepository
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MahfelWebSocket @Inject constructor(
    private val client: OkHttpClient,
    private val json: Json,
    private val tokenStore: com.noorestan.app.data.local.preferences.AuthTokenStore
) : MahfelRepository {

    private val _isConnected = MutableStateFlow(false)
    override val isConnected: Flow<Boolean> = _isConnected.asStateFlow()

    private val _peers = MutableStateFlow<List<Peer>>(emptyList())
    override fun peers(): Flow<List<Peer>> = _peers.asStateFlow()

    private val _rooms = MutableStateFlow<List<Room>>(emptyList())
    override fun rooms(): Flow<List<Room>> = _rooms.asStateFlow()

    private val _leaderboard = MutableStateFlow<List<LeaderboardEntry>>(emptyList())
    override fun leaderboard(): Flow<List<LeaderboardEntry>> = _leaderboard.asStateFlow()

    private val _chat = MutableStateFlow<List<ChatMessage>>(emptyList())
    override fun chat(): Flow<List<ChatMessage>> = _chat.asStateFlow()

    private var socket: WebSocket? = null
    private var clientId: String? = null
    private var pendingHello: Triple<String, Int, Int>? = null
    private var pendingToken: String? = null

    private fun wsUrl(): String {
        val base = BuildConfig.WS_URL.trimEnd('/')
        return "$base/"
    }

    override suspend fun connect(name: String, level: Int, score: Int, userToken: String?) {
        pendingHello = Triple(name, level, score)
        pendingToken = userToken
        if (socket != null) return
        val request = Request.Builder().url(wsUrl()).build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _isConnected.value = true
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
                socket = null
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _isConnected.value = false
                socket = null
            }
        })
    }

    private fun sendRaw(obj: Map<String, Any?>) {
        val s = socket ?: return
        val jo = kotlinx.serialization.json.buildJsonObject {
            put("ns", kotlinx.serialization.json.JsonPrimitive("noorestan"))
            obj.forEach { (k, v) ->
                when (v) {
                    null -> put(k, kotlinx.serialization.json.JsonNull)
                    is String -> put(k, kotlinx.serialization.json.JsonPrimitive(v))
                    is Int -> put(k, kotlinx.serialization.json.JsonPrimitive(v))
                    is Long -> put(k, kotlinx.serialization.json.JsonPrimitive(v))
                    is Boolean -> put(k, kotlinx.serialization.json.JsonPrimitive(v))
                }
            }
        }
        s.send(jo.toString())
    }

    private fun handleMessage(text: String) {
        val el = try { json.parseToJsonElement(text) } catch (_: Exception) { return }
        val o = el as? JsonObject ?: return
        val t = o["t"]?.jsonPrimitive?.content ?: return
        when (t) {
            "welcome" -> {
                clientId = o["id"]?.jsonPrimitive?.content
                val h = pendingHello
                if (h != null) {
                    val map = mutableMapOf<String, Any?>(
                        "t" to "hello",
                        "name" to h.first,
                        "level" to h.second,
                        "score" to h.third
                    )
                    pendingToken?.let { map["userToken"] = it }
                    tokenStoreUserId()?.let { map["userId"] = it }
                    sendRaw(map)
                    pendingHello = null
                }
            }
            "peers" -> {
                val list = o["list"] as? JsonArray ?: return
                _peers.value = list.mapNotNull { e ->
                    val jo = e as? JsonObject ?: return@mapNotNull null
                    Peer(
                        id = jo["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
                        name = jo["name"]?.jsonPrimitive?.content ?: "بازیکن",
                        level = jo["level"]?.jsonPrimitive?.intOrNull ?: 1,
                        score = jo["score"]?.jsonPrimitive?.intOrNull ?: 0
                    )
                }
            }
            "rooms" -> {
                val list = o["list"] as? JsonArray ?: return
                _rooms.value = list.mapNotNull { e ->
                    val jo = e as? JsonObject ?: return@mapNotNull null
                    Room(
                        code = jo["code"]?.jsonPrimitive?.content ?: return@mapNotNull null,
                        name = jo["name"]?.jsonPrimitive?.content ?: "روم",
                        game = jo["game"]?.jsonPrimitive?.content ?: "dooz",
                        hostId = jo["host"]?.jsonPrimitive?.content,
                        members = jo["count"]?.jsonPrimitive?.intOrNull ?: 0,
                        maxMembers = jo["max"]?.jsonPrimitive?.intOrNull ?: 8
                    )
                }
            }
            "lb" -> {
                val list = o["list"] as? JsonArray ?: return
                _leaderboard.value = list.mapNotNull { e ->
                    val jo = e as? JsonObject ?: return@mapNotNull null
                    LeaderboardEntry(
                        name = jo["name"]?.jsonPrimitive?.content ?: "بازیکن",
                        uid = jo["uid"]?.jsonPrimitive?.content,
                        score = jo["score"]?.jsonPrimitive?.intOrNull ?: 0
                    )
                }
            }
            "chat" -> {
                val text = o["text"]?.jsonPrimitive?.content ?: return
                val from = o["from"]?.jsonPrimitive?.content
                    ?: o["name"]?.jsonPrimitive?.content ?: "سیستم"
                val sys = o["sys"]?.jsonPrimitive?.booleanOrNull ?: false
                val msg = ChatMessage(from = from, text = text, system = sys)
                _chat.value = (_chat.value + msg).takeLast(200)
            }
            "room:joined", "room:update" -> {
                // store as chat system message for now
            }
            "notif" -> {
                val title = o["title"]?.jsonPrimitive?.content ?: ""
                val desc = o["desc"]?.jsonPrimitive?.content ?: ""
                val msg = ChatMessage(from = "اعلان", text = "$title: $desc", system = true)
                _chat.value = (_chat.value + msg).takeLast(200)
            }
        }
    }

    // placeholder; AuthTokenStore not injected here. We'll pass userId via pending? Keep simple.
    private fun tokenStoreUserId(): String? = tokenStore.getUserId()

    override suspend fun disconnect() {
        socket?.close(1000, "bye")
        socket = null
        _isConnected.value = false
    }

    override suspend fun createRoom(name: String, game: String) {
        sendRaw(mapOf("t" to "room:create", "name" to name, "game" to game))
    }

    override suspend fun joinRoom(code: String) {
        sendRaw(mapOf("t" to "room:join", "code" to code))
    }

    override suspend fun spectateRoom(code: String) {
        sendRaw(mapOf("t" to "room:spectate", "code" to code))
    }

    override suspend fun leaveRoom() {
        sendRaw(mapOf("t" to "room:leave"))
    }

    override suspend fun startGame(game: String?, force: Boolean) {
        val m = mutableMapOf<String, Any?>("t" to "room:start", "force" to force)
        game?.let { m["game"] = it }
        sendRaw(m)
    }

    override suspend fun sendChat(text: String) {
        sendRaw(mapOf("t" to "chat", "text" to text))
    }

    override suspend fun sendMove(index: Int) {
        sendRaw(mapOf("t" to "room:game", "index" to index))
    }

    override suspend fun submitEsmfamil(answer: String) {
        sendRaw(mapOf("t" to "room:game", "phase" to "submit", "answer" to answer))
    }

    override suspend fun nextEsmfamil() {
        sendRaw(mapOf("t" to "room:game", "phase" to "next"))
    }

    override suspend fun sendReaction(emoji: String) {
        sendRaw(mapOf("t" to "react", "emoji" to emoji))
    }

    override suspend fun sendFriendRequest(toId: String) {
        sendRaw(mapOf("t" to "friend:req", "to" to toId))
    }

    override suspend fun acceptFriend(toId: String) {
        sendRaw(mapOf("t" to "friend:ok", "to" to toId))
    }

    override suspend fun declineFriend(toId: String) {
        sendRaw(mapOf("t" to "friend:no", "to" to toId))
    }

    override suspend fun putScore(score: Int) {
        sendRaw(mapOf("t" to "lb:put", "score" to score))
    }
}
