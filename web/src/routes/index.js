'use strict';

const express = require('express');
const { authPool } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    let realms = [];
    try {
      const [rows] = await authPool.query(
        'SELECT id, name, address, port FROM realmlist ORDER BY id'
      );
      realms = rows;
    } catch (e) {
      // realmlist jadvali hali yaratilmagan bo'lishi mumkin (bnetserver birinchi
      // marta ishga tushmagan) - bu sahifani ishdan chiqarmasligi kerak.
      realms = [];
    }

    res.render('home', { title: 'Bosh sahifa', realms });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
