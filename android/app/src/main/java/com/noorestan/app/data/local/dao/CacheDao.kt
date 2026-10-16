package com.noorestan.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.noorestan.app.data.local.entity.CacheEntry
import kotlinx.coroutines.flow.Flow

@Dao
interface CacheDao {
    @Query("SELECT * FROM cache WHERE key = :key")
    suspend fun get(key: String): CacheEntry?

    @Query("SELECT * FROM cache WHERE key = :key")
    fun observe(key: String): Flow<CacheEntry?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entry: CacheEntry)

    @Query("DELETE FROM cache WHERE key = :key")
    suspend fun delete(key: String)
}
