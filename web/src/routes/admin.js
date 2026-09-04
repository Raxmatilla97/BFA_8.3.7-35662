'use strict';

const express = require('express');
const { authPool, charPool } = require('../db');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Ruxsat yo\'q',
      message: "Bu sahifa faqat administratorlar uchun.",
    });
  }
  next();
}

router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const [accounts] = await authPool.query(`
      SELECT ba.id, ba.email, ba.joindate, ba.last_login, ba.last_ip, ba.locked,
             wp.nickname, wp.role
      FROM battlenet_accounts ba
      LEFT JOIN web_profiles wp ON wp.bnet_account_id = ba.id
      ORDER BY ba.id DESC
    `);

    const [realms] = await authPool.query(
      'SELECT id, name, address, port, gamebuild FROM realmlist ORDER BY id'
    );

    let characterCount = null;
    try {
      const [[row]] = await charPool.query('SELECT COUNT(*) AS cnt FROM characters');
      characterCount = row.cnt;
    } catch (e) {
      characterCount = null; // characters bazasi hali sozlanmagan bo'lishi mumkin
    }

    res.render('admin', {
      title: 'Admin panel',
      accounts,
      realms,
      characterCount,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/accounts/:id/toggle-lock', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await authPool.query(
      'SELECT locked FROM battlenet_accounts WHERE id = ?',
      [id]
    );
    if (row) {
      await authPool.query('UPDATE battlenet_accounts SET locked = ? WHERE id = ?', [
        row.locked ? 0 : 1,
        id,
      ]);
    }
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/admin/accounts/:id/toggle-role', requireAdmin, async (req, res, next) => {
  try {
    const bnetAccountId = Number(req.params.id);

    const [[profile]] = await authPool.query(
      'SELECT role FROM web_profiles WHERE bnet_account_id = ?',
      [bnetAccountId]
    );
    const currentRole = profile ? profile.role : 'user';
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';

    await authPool.query(
      'UPDATE web_profiles SET role = ? WHERE bnet_account_id = ?',
      [nextRole, bnetAccountId]
    );

    const [gameAccounts] = await authPool.query(
      'SELECT id FROM account WHERE battlenet_account = ?',
      [bnetAccountId]
    );

    for (const ga of gameAccounts) {
      if (nextRole === 'admin') {
        await authPool.query(
          `INSERT INTO account_access (AccountID, SecurityLevel, RealmID, Comment)
           VALUES (?, 3, -1, 'BFA UZBEK COMUNITY BETTA admin panelidan tayinlandi')
           ON DUPLICATE KEY UPDATE SecurityLevel = 3`,
          [ga.id]
        );
      } else {
        await authPool.query(
          'DELETE FROM account_access WHERE AccountID = ? AND RealmID = -1',
          [ga.id]
        );
      }
    }

    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
