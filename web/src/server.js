'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

const { waitForDatabase } = require('./db');
const { ensureAdminAccount } = require('./seedAdmin');
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = Number(process.env.WEB_PORT || 3000);
const SITE_NAME = process.env.SITE_NAME || 'BFA UZBEK COMUNITY BETTA';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'bfa.sid',
    secret: process.env.SESSION_SECRET || 'bfa-uzbek-comunity-betta-maxfiy-kalit',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 kun
    },
  })
);

// Har bir sahifada kerak bo'ladigan umumiy ma'lumotlar
app.use((req, res, next) => {
  res.locals.siteName = SITE_NAME;
  res.locals.currentUser = req.session.user || null;
  res.locals.error = null;
  res.locals.success = null;
  next();
});

app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', profileRouter);
app.use('/', adminRouter);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Sahifa topilmadi' });
});

// Xatoliklarni ushlash
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Server xatosi',
    message: 'Kutilmagan xatolik yuz berdi. Birozdan so\'ng qayta urinib ko\'ring.',
  });
});

async function main() {
  await waitForDatabase();
  await ensureAdminAccount();
  app.listen(PORT, () => {
    console.log(`[web] ${SITE_NAME} sayti http://0.0.0.0:${PORT} manzilida ishga tushdi.`);
  });
}

main().catch((err) => {
  console.error('[web] Ilovani ishga tushirib bo\'lmadi:', err);
  process.exit(1);
});
