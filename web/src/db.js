'use strict';

const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'mysql';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const AUTH_DB_NAME = process.env.AUTH_DB_NAME || 'auth';
const CHAR_DB_NAME = process.env.CHAR_DB_NAME || 'characters';

const baseOptions = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
};

// TrinityCore-ning o'zi ishlatadigan `auth` (bnetserver/authserver) va
// `characters` (worldserver) bazalariga ikkita alohida pool.
const authPool = mysql.createPool({ ...baseOptions, database: AUTH_DB_NAME });
const charPool = mysql.createPool({ ...baseOptions, database: CHAR_DB_NAME });

// Sayt uchun qo'shimcha jadval - TrinityCore jadvallariga tegmaydi,
// faqat taxallus/profil ma'lumotlarini saqlaydi.
async function ensureWebSchema() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS web_profiles (
      bnet_account_id INT UNSIGNED NOT NULL PRIMARY KEY,
      nickname VARCHAR(32) NOT NULL,
      bio VARCHAR(255) NOT NULL DEFAULT '',
      role VARCHAR(16) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY idx_nickname (nickname)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Eski o'rnatishlarda "role" ustuni bo'lmasligi mumkin - xavfsiz qo'shamiz.
  const [cols] = await authPool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_profiles' AND COLUMN_NAME = 'role'`
  );
  if (cols[0].cnt === 0) {
    await authPool.query(
      "ALTER TABLE web_profiles ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user'"
    );
  }
}

/**
 * Baza hali tayyor bo'lmasa (bnetserver/worldserver birinchi marta ishga
 * tushib, jadvallarni yaratayotgan bo'lishi mumkin) - bir necha marta qayta
 * urinib ko'ramiz.
 */
async function waitForDatabase(retries = 60, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await authPool.getConnection();
      conn.release();
      await ensureWebSchema();
      console.log('[db] auth bazasiga muvaffaqiyatli ulanildi.');
      return;
    } catch (err) {
      console.log(
        `[db] auth bazasiga ulanish (${attempt}/${retries}) muvaffaqiyatsiz: ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('auth bazasiga ulanib bo\'lmadi (timeout).');
}

module.exports = { authPool, charPool, waitForDatabase, ensureWebSchema };
