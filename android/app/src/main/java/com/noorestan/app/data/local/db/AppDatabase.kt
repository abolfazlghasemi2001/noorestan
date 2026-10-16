package com.noorestan.app.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.noorestan.app.data.local.dao.CacheDao
import com.noorestan.app.data.local.entity.CacheEntry

@Database(entities = [CacheEntry::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun cacheDao(): CacheDao
}
