'use strict';

const { authPool } = require('./db');
const {
  utf8ToUpperOnlyLatin,
  makeSrp6RegistrationData,
  calculateBnetShaPassHash,
} = require('./trinityAuth');

/**
 * Muhit o'zgaruvchilaridan (ADMIN_LOGIN / ADMIN_PASSWORD) admin akkauntini
 * avtomatik yaratadi (yoki, agar allaqachon mavjud bo'lsa, parolini va
 * huquqlarini shu qiymatlarga moslab yangilaydi). Har xizmat ishga tushganda
 * chaqirilishi xavfsiz (idempotent).
 *
 * Bu akkaunt bilan:
 *   - Saytga (email/login sifatida ADMIN_LOGIN, parol ADMIN_PASSWORD) kirish,
 *   - "Admin panel" (/admin) ga kirish,
 *   - (worldserver + xarita ma'lumotlari sozlangach) o'yin ichida to'liq GM/
 *     administrator huquqlari bilan kirish mumkin bo'ladi
 *     (account_access.SecurityLevel = 3, barcha realmlar uchun).
 */
async function ensureAdminAccount() {
  const ADMIN_LOGIN = (process.env.ADMIN_LOGIN || '').trim();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    console.log(
      '[seed] ADMIN_LOGIN / ADMIN_PASSWORD berilmagan - admin akkaunt avtomatik yaratilmaydi.'
    );
    return;
  }

  const loginUpper = utf8ToUpperOnlyLatin(ADMIN_LOGIN);
  const passwordUpper = utf8ToUpperOnlyLatin(ADMIN_PASSWORD);
  const shaPassHash = calculateBnetShaPassHash(loginUpper, passwordUpper);

  const conn = await authPool.getConnection();
  let bnetAccountId;
  try {
    const [existing] = await conn.query(
      'SELECT id FROM battlenet_accounts WHERE email = ?',
      [loginUpper]
    );

    if (existing.length > 0) {
      bnetAccountId = existing[0].id;
      // Akkaunt allaqachon mavjud - parolni/holatini .env dagi qiymatga moslab qo'yamiz.
      await conn.query(
        'UPDATE battlenet_accounts SET sha_pass_hash = ?, locked = 0 WHERE id = ?',
        [shaPassHash, bnetAccountId]
      );
    } else {
      await conn.beginTransaction();

      const [bnetResult] = await conn.query(
        'INSERT INTO battlenet_accounts (email, sha_pass_hash) VALUES (?, ?)',
        [loginUpper, shaPassHash]
      );
      bnetAccountId = bnetResult.insertId;

      const gameAccountName = utf8ToUpperOnlyLatin(`${bnetAccountId}#1`);
      const { salt, verifier } = makeSrp6RegistrationData(gameAccountName, passwordUpper);

      await conn.query(
        `INSERT INTO account (username, salt, verifier, reg_mail, email, joindate, battlenet_account, battlenet_index)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, 1)`,
        [gameAccountName, salt, verifier, loginUpper, loginUpper, bnetAccountId]
      );

      await conn.query(
        `INSERT INTO realmcharacters (realmid, acctid, numchars)
         SELECT realmlist.id, account.id, 0 FROM realmlist, account
         LEFT JOIN realmcharacters ON acctid = account.id WHERE acctid IS NULL`
      );

      await conn.commit();
    }
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_e) {
      /* ignore */
    }
    conn.release();
    console.error('[seed] Admin akkauntini yaratib bo\'lmadi:', err);
    return;
  }
  conn.release();

  try {
    // Shu bnet akkauntga bog'liq HAR BIR o'yin akkauntiga to'liq GM/administrator
    // huquqini beramiz (SecurityLevel 3, RealmID -1 = barcha realmlarda amal qiladi).
    const [gameAccounts] = await authPool.query(
      'SELECT id FROM account WHERE battlenet_account = ?',
      [bnetAccountId]
    );
    for (const ga of gameAccounts) {
      await authPool.query(
        `INSERT INTO account_access (AccountID, SecurityLevel, RealmID, Comment)
         VALUES (?, 3, -1, 'BFA UZBEK COMUNITY BETTA - sayt orqali avtomatik sozlangan admin')
         ON DUPLICATE KEY UPDATE SecurityLevel = 3`,
        [ga.id]
      );
    }

    // Taxallus (nickname) ustida UNIQUE indeks bor - agar shu taxallus allaqachon
    // BOSHQA (admin bo'lmagan) akkauntga tegishli bo'lsa (masalan, ADMIN_LOGIN'ni
    // deploydan keyin o'zgartirib qo'ysangiz), o'sha begona akkauntga tasodifan
    // admin huquqi berib qo'ymaslik uchun avval tekshirib olamiz.
    const [nickConflict] = await authPool.query(
      'SELECT bnet_account_id FROM web_profiles WHERE nickname = ? AND bnet_account_id != ?',
      [ADMIN_LOGIN, bnetAccountId]
    );
    const nicknameForAdmin = nickConflict.length > 0 ? `${ADMIN_LOGIN}-admin` : ADMIN_LOGIN;
    if (nickConflict.length > 0) {
      console.warn(
        `[seed] "${ADMIN_LOGIN}" taxallusi boshqa akkauntda band edi - admin uchun ` +
          `"${nicknameForAdmin}" ishlatildi.`
      );
    }

    await authPool.query(
      `INSERT INTO web_profiles (bnet_account_id, nickname, role)
       VALUES (?, ?, 'admin')
       ON DUPLICATE KEY UPDATE role = 'admin'`,
      [bnetAccountId, nicknameForAdmin]
    );

    console.log(`[seed] Admin akkaunt tayyor: login="${ADMIN_LOGIN}" (bnet id=${bnetAccountId}).`);
  } catch (err) {
    console.error('[seed] Admin huquqlarini sozlashda xatolik:', err);
  }
}

module.exports = { ensureAdminAccount };
