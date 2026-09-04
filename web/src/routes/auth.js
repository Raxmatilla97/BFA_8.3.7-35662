'use strict';

const express = require('express');
const { authPool } = require('../db');
const {
  utf8ToUpperOnlyLatin,
  makeSrp6RegistrationData,
  calculateBnetShaPassHash,
} = require('../trinityAuth');

const router = express.Router();

const MAX_PASS_LEN = 16; // AccountMgr.h: MAX_PASS_STR
const MAX_EMAIL_LEN = 320; // BattlenetAccountMgr.h: MAX_BNET_EMAIL_STR
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/profile');
  res.render('register', { title: "Ro'yxatdan o'tish", error: null, old: {} });
});

router.post('/register', async (req, res, next) => {
  if (req.session.user) return res.redirect('/profile');

  const nickname = (req.body.nickname || '').trim();
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const password2 = req.body.password2 || '';
  const old = { nickname, email };

  function fail(message) {
    return res.status(400).render('register', {
      title: "Ro'yxatdan o'tish",
      error: message,
      old,
    });
  }

  if (nickname.length < 2 || nickname.length > 32) {
    return fail("Taxallus 2 dan 32 belgigacha bo'lishi kerak.");
  }
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return fail("Elektron pochta manzili noto'g'ri kiritildi.");
  }
  if (!password || password.length > MAX_PASS_LEN) {
    return fail(`Parol 1 dan ${MAX_PASS_LEN} belgigacha bo'lishi kerak.`);
  }
  if (password !== password2) {
    return fail('Parollar bir-biriga mos emas.');
  }

  const emailUpper = utf8ToUpperOnlyLatin(email);
  const passwordUpper = utf8ToUpperOnlyLatin(password);

  const conn = await authPool.getConnection();
  try {
    const [existingEmail] = await conn.query(
      'SELECT id FROM battlenet_accounts WHERE email = ?',
      [emailUpper]
    );
    if (existingEmail.length > 0) {
      return fail("Bu elektron pochta bilan akkaunt allaqachon ro'yxatdan o'tgan.");
    }

    const [existingNick] = await conn.query(
      'SELECT bnet_account_id FROM web_profiles WHERE nickname = ?',
      [nickname]
    );
    if (existingNick.length > 0) {
      return fail('Bu taxallus band. Boshqasini tanlang.');
    }

    await conn.beginTransaction();

    // 1) Battle.net turdagi akkaunt (haqiqiy WoW mijozi shu email/parol bilan kiradi)
    //    Battlenet::AccountMgr::CreateBattlenetAccount bilan bir xil algoritm.
    const shaPassHash = calculateBnetShaPassHash(emailUpper, passwordUpper);
    const [bnetResult] = await conn.query(
      'INSERT INTO battlenet_accounts (email, sha_pass_hash) VALUES (?, ?)',
      [emailUpper, shaPassHash]
    );
    const bnetAccountId = bnetResult.insertId;

    // 2) Unga bog'langan o'yin akkaunti "<id>#1" - AccountMgr::CreateAccount bilan bir xil.
    const gameAccountName = utf8ToUpperOnlyLatin(`${bnetAccountId}#1`);
    const { salt, verifier } = makeSrp6RegistrationData(gameAccountName, passwordUpper);

    await conn.query(
      `INSERT INTO account (username, salt, verifier, reg_mail, email, joindate, battlenet_account, battlenet_index)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, 1)`,
      [gameAccountName, salt, verifier, emailUpper, emailUpper, bnetAccountId]
    );

    // 3) LOGIN_INS_REALM_CHARACTERS_INIT bilan bir xil so'rov - har bir realm uchun
    //    belgilar sonini 0 qilib ishga tushiradi.
    await conn.query(
      `INSERT INTO realmcharacters (realmid, acctid, numchars)
       SELECT realmlist.id, account.id, 0 FROM realmlist, account
       LEFT JOIN realmcharacters ON acctid = account.id WHERE acctid IS NULL`
    );

    // 4) Faqat shu sayt uchun - taxallus/profil
    await conn.query(
      'INSERT INTO web_profiles (bnet_account_id, nickname) VALUES (?, ?)',
      [bnetAccountId, nickname]
    );

    await conn.commit();

    req.session.user = { bnetAccountId, email: emailUpper, nickname, role: 'user' };
    return res.redirect('/profile');
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_e) {
      /* ignore */
    }
    return next(err);
  } finally {
    conn.release();
  }
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/profile');
  res.render('login', { title: 'Kirish', error: null, old: {} });
});

router.post('/login', async (req, res, next) => {
  if (req.session.user) return res.redirect('/profile');

  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const old = { email };

  function fail(message) {
    return res.status(400).render('login', { title: 'Kirish', error: message, old });
  }

  if (!email || !password) {
    return fail("Email va parolni kiriting.");
  }

  const emailUpper = utf8ToUpperOnlyLatin(email);
  const passwordUpper = utf8ToUpperOnlyLatin(password);

  try {
    const [rows] = await authPool.query(
      'SELECT id, email, sha_pass_hash, locked FROM battlenet_accounts WHERE email = ?',
      [emailUpper]
    );

    if (rows.length === 0) {
      return fail("Email yoki parol noto'g'ri.");
    }

    const account = rows[0];
    const computed = calculateBnetShaPassHash(emailUpper, passwordUpper);

    if (computed !== account.sha_pass_hash) {
      return fail("Email yoki parol noto'g'ri.");
    }

    if (account.locked) {
      return fail("Bu akkaunt bloklangan. Administrator bilan bog'laning.");
    }

    const [profileRows] = await authPool.query(
      'SELECT nickname, role FROM web_profiles WHERE bnet_account_id = ?',
      [account.id]
    );
    const nickname = profileRows.length > 0 ? profileRows[0].nickname : emailUpper;
    const role = profileRows.length > 0 ? profileRows[0].role : 'user';

    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .toString()
      .split(',')[0]
      .trim()
      .slice(0, 15) || '127.0.0.1';

    await authPool.query(
      'UPDATE battlenet_accounts SET last_login = NOW(), last_ip = ? WHERE id = ?',
      [clientIp, account.id]
    );

    req.session.user = { bnetAccountId: account.id, email: account.email, nickname, role };
    return res.redirect('/profile');
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
