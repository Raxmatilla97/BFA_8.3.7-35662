'use strict';

const express = require('express');
const { authPool, charPool } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Asosiy (klassik) irq/klasslar uchun o'zbekcha nomlar. Ittifoqchi irqlar
// (Allied Races, ID 24+) ko'p va DB2 fayllariga bog'liq bo'lgani uchun
// bu yerda faqat ID ko'rsatiladi - noto'g'ri taxmindan ko'ra shu ma'qulroq.
const RACE_NAMES = {
  1: 'Inson', 2: 'Ork', 3: 'Dvarf', 4: 'Tun elfi', 5: "O'lik-tirik",
  6: 'Tauren', 7: 'Gnom', 8: 'Troll', 9: 'Goblin', 10: 'Qon elfi',
  11: 'Draeney', 22: 'Vorgen',
};
const CLASS_NAMES = {
  1: 'Jangchi', 2: 'Muqaddas jangchi', 3: 'Merganchi', 4: "O'g'ri", 5: 'Ruhoniy',
  6: "O'lim ritsari", 7: 'Shaman', 8: 'Sehrgar', 9: 'Jinchaqiruvchi', 10: 'Rohib',
  11: 'Druid', 12: 'Ov mergani',
};

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const { bnetAccountId } = req.session.user;

    const [bnetRows] = await authPool.query(
      'SELECT id, email, joindate, last_login, last_ip, online FROM battlenet_accounts WHERE id = ?',
      [bnetAccountId]
    );
    if (bnetRows.length === 0) {
      req.session.destroy(() => {});
      return res.redirect('/login');
    }
    const bnetAccount = bnetRows[0];

    const [profileRows] = await authPool.query(
      'SELECT nickname, bio, created_at FROM web_profiles WHERE bnet_account_id = ?',
      [bnetAccountId]
    );
    const profile = profileRows[0] || { nickname: bnetAccount.email, bio: '', created_at: bnetAccount.joindate };

    const [gameAccounts] = await authPool.query(
      'SELECT id, username, expansion, online, last_login FROM account WHERE battlenet_account = ? ORDER BY battlenet_index',
      [bnetAccountId]
    );

    let characters = [];
    if (gameAccounts.length > 0) {
      const accountIds = gameAccounts.map((a) => a.id);
      const placeholders = accountIds.map(() => '?').join(',');
      try {
        const [charRows] = await charPool.query(
          `SELECT guid, name, race, class, gender, level, online
           FROM characters WHERE account IN (${placeholders}) ORDER BY level DESC`,
          accountIds
        );
        characters = charRows.map((c) => ({
          ...c,
          raceName: RACE_NAMES[c.race] || `Ittifoqchi irq (#${c.race})`,
          className: CLASS_NAMES[c.class] || `#${c.class}`,
        }));
      } catch (e) {
        // characters bazasi hali sozlanmagan bo'lishi mumkin - sahifani buzmaymiz
        characters = [];
      }
    }

    res.render('profile', {
      title: 'Profil',
      bnetAccount,
      profile,
      gameAccounts,
      characters,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
