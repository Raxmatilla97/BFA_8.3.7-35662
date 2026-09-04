# BFA UZBEK COMUNITY BETTA — Docker bilan ishga tushirish qo'llanmasi

Bu hujjat ushbu repozitoriyga qo'shilgan **Docker** infratuzilmasi va
**"BFA UZBEK COMUNITY BETTA"** veb-saytini (ro'yxatdan o'tish / kirish /
profil) qanday ishga tushirishni tushuntiradi.

---

## 1. Nima qo'shildi?

| Fayl/papka | Vazifasi |
|---|---|
| `Dockerfile` | TrinityCore manba kodini (`bnetserver`, `worldserver`, xarita asboblari) quradigan ko'p bosqichli image |
| `docker-compose.yml` | Barcha xizmatlarni (MySQL, bnetserver, worldserver, veb-sayt) birga ishga tushiradi |
| `docker/scripts/` | Konteynerlar ichida ishlaydigan tayyorlov skriptlari (baza kutish, konfiguratsiya, sertifikat) |
| `web/` | Node.js/Express asosidagi **BFA UZBEK COMUNITY BETTA** sayti (to'liq o'zbek tilida) |
| `server-data/` | O'yin dunyosi uchun xarita fayllari joylashadigan papka (o'zingiz to'ldirasiz — pastga qarang) |
| `.env.example` | Sozlanadigan muhit o'zgaruvchilari namunasi |

Veb-sayt to'g'ridan-to'g'ri TrinityCore-ning **haqiqiy** `auth` bazasi bilan
ishlaydi va akkaunt yaratishda **aynan TrinityCore/bnetserver ishlatadigan**
SRP6 va SHA-256 algoritmlarini qo'llaydi (`web/src/trinityAuth.js` da manba
kod qatorlariga havolalar bilan izohlangan). Ya'ni: sayt orqali ro'yxatdan
o'tgan akkaunt bilan **haqiqiy WoW mijozi ham kira oladi** — bu faqat
"ko'rsatmalik" sayt emas.

---

## 2. Talablar

- **Docker Desktop** (Windows/Mac) yoki Docker Engine + Compose plugin (Linux)
- Birinchi qurishda (build): kamida **4 GB bo'sh disk** va **8 GB RAM**
  tavsiya etiladi (kod to'liq kompilyatsiya qilinadi — bu 30–90+ daqiqa
  davom etishi mumkin, kompyuter tezligiga bog'liq)
- **WoW 8.3.7 mijozi** va **TDB (to'liq world bazasi)** — **faqat**
  to'liq o'ynash mumkin bo'lgan worldserver uchun kerak (pastga qarang,
  §6). Bular mualliflik huquqi bilan himoyalangan bo'lgani uchun ushbu
  repoga kiritilmagan va men tomonimdan taqdim etilmaydi.

---

## 3. Tezkor boshlash

```bash
cp .env.example .env
```

`.env` faylini oching va kamida `DB_PASSWORD` hamda `SESSION_SECRET`
qiymatlarini o'zgartiring (production uchun muhim).

### Faqat sayt + login serverini ishga tushirish (worldserversiz)

Bu eng tezkor yo'l — sayt darhol ishlaydi, akkaunt yaratish/kirish/profil
to'liq ishlaydi:

```bash
docker compose up -d --build mysql bnetserver web
```

Bir necha daqiqadan so'ng (bnetserver birinchi marta bazani yaratganda):

- Sayt: **http://localhost:8086**
- Battle.net login porti: `1119`, REST: `8081`

### Hammasini birga (worldserver bilan)

```bash
docker compose up -d --build
```

> **Eslatma:** `worldserver` xarita ma'lumotlarisiz ham ishga tushishga
> urinadi, lekin haritalar/NPC/questlar bo'lmagani uchun to'liq
> foydalanib bo'lmaydi. Qadam-baqadam to'liq sozlash uchun §7 ga qarang.

Loglarni kuzatish:

```bash
docker compose logs -f bnetserver
docker compose logs -f worldserver
docker compose logs -f web
```

To'xtatish:

```bash
docker compose down
```

(Ma'lumotlar `mysql-data`, `bnetserver-etc`, `worldserver-etc` nomli Docker
volume'larida saqlanadi — `docker compose down -v` ular bilan birga
**butunlay o'chiradi**, ehtiyot bo'ling.)

---

## 4. Sayt qanday ishlaydi?

- **Ro'yxatdan o'tish** (`/register`): Taxallus, email, parol (1–16 belgi —
  bu o'yin mijozining o'ziga xos cheklovi). Tizim avtomatik ravishda:
  1. `battlenet_accounts` jadvalida email/parol xeshini yaratadi
     (aynan `Battlenet::AccountMgr::CalculateShaPassHash` algoritmi).
  2. Unga bog'langan `<id>#1` nomli o'yin akkauntini SRP6 tuz/verifier
     bilan yaratadi (aynan `SRP6::MakeRegistrationData` algoritmi).
  3. Har bir realm uchun belgilar sonini ishga tushiradi.
  4. Faqat sayt uchun (`web_profiles` jadvali) taxallus/profil yozuvini
     qo'shadi.
- **Kirish** (`/login`): email/parolni `battlenet_accounts` bazasidagi
  xesh bilan solishtiradi.
- **Profil** (`/profile`): akkaunt ma'lumotlari, bog'langan o'yin akkaunti
  va (agar worldserver ishlab, o'yinchi belgi yaratgan bo'lsa)
  belgilar ro'yxatini ko'rsatadi.

Sayt manba kodi: [web/src](web/src)

---

## 5. Admin akkaunt

`.env` faylida `ADMIN_LOGIN` va `ADMIN_PASSWORD` ni to'ldirsangiz (masalan
`ADMIN_LOGIN=admin`), veb-sayt konteyneri **har ishga tushganda avtomatik**:

1. Shu login/parol bilan Battle.net akkaunt va unga bog'langan o'yin
   akkauntini yaratadi (agar hali yo'q bo'lsa) — yoki mavjud bo'lsa, parolini
   `.env` dagi qiymatga moslab yangilaydi.
2. `account_access` jadvaliga **barcha realmlar uchun to'liq
   GM/administrator huquqi** (`SecurityLevel = 3`) qo'shadi — ya'ni
   worldserver + xarita ma'lumotlari sozlangach, shu akkaunt bilan o'yin
   ichida to'liq admin (GM buyruqlari, `.gm on`, teleport va h.k.) sifatida
   kirasiz.
3. Saytda `role = 'admin'` qilib belgilaydi — shu bilan **"Admin panel"**
   (`/admin`) menyusi ochiladi: barcha ro'yxatdan o'tgan akkauntlar ro'yxati,
   ularni bloklash/blokdan chiqarish va admin huquqini berish/olib qo'yish.

Ya'ni **bitta login/parol bilan ham saytga (Admin panel), ham (worldserver
sozlangach) o'yinga administrator sifatida kira olasiz** — aynan shu narsani
so'ragan edingiz.

> ⚠️ **Xavfsizlik:** `ADMIN_LOGIN`/`ADMIN_PASSWORD` qiymatlarini **faqat**
> `.env` faylida saqlang (u Git-ga kirmaydi). Ularni hech qachon `README`,
> commit xabari yoki boshqa Git-ga qo'shiladigan faylga yozmang — aks holda
> parolingiz ochiq repozitoriyda saqlanib qoladi.

---

## 6. Realm sozlash

> ℹ️ **Port taqsimoti:** veb-sayt **8086** portida, worldserver (o'yin porti)
> esa o'zgarishsiz, standart **8085** portida ishlaydi.

Standart bazada bitta namunaviy realm mavjud (`Trinity`, `127.0.0.1:8085`).
Uni tahrirlash uchun MySQL ga ulaning:

```bash
docker compose exec mysql mysql -uroot -p auth
```

```sql
UPDATE realmlist
SET name = 'BFA UZBEK COMUNITY',
    address = '<serveringiz-tashqi-IP-manzili>',
    localAddress = '127.0.0.1',
    port = 8085
WHERE id = 1;
```

`gamebuild` ustunini ham o'zingizdagi WoW 8.3.7 mijozining aniq build
raqamiga moslang (mijoz papkasidagi versiya ma'lumotidan tekshiring).

---

## 7. To'liq o'ynaladigan worldserver uchun kerak bo'ladigan qo'shimcha qadamlar

TrinityCore manba kodi va bo'sh baza tuzilmasi o'zi bilan **o'ynaladigan
dunyo** bermaydi. Quyidagilar zarur va **men ularni siz uchun yarata
olmayman** (mualliflik huquqi/hajmi sababli):

1. **Xarita ma'lumotlari** (`dbc`, `maps`, `vmaps`, `mmaps`) — qonuniy WoW
   8.3.7 mijozidan `mapextractor`/`vmap4extractor`/`vmap4assembler`/
   `mmaps_generator` asboblari bilan ajratib olinadi. Ushbu asboblarni
   qurish uchun:
   ```bash
   docker compose build tools
   ```
   Keyingi qadamlar [server-data/README.md](server-data/README.md) da.
2. **To'liq "world"/"hotfixes" bazasi (TDB)** — ushbu core versiyasiga mos
   TrinityCore Database dump fayli alohida topilib import qilinishi kerak
   (ichida NPC, quest, item va h.k. bo'ladi). Hozirgi holatda bu bazalar
   faqat **bo'sh tuzilmaga** ega.

Bularsiz ham bnetserver/sayt orqali akkaunt yaratish, kirish va profilni
ko'rish **to'liq ishlaydi** — faqat haqiqiy o'yin dunyosiga (worldserver)
kirish uchun yuqoridagilar zarur.

### WoW mijozidan ulanish haqida eslatma

BfA (8.x) mijozi klassik "realmlist.wtf" usuli bilan emas, balki
**Battle.net App orqali** serverlarga ulanadi. Shaxsiy (private)
serverlarga ulanish uchun odatda maxsus ishga tushirgich (launcher)
ishlatiladi, u mijozni to'g'ridan-to'g'ri sizning `bnetserver`
manzilingizga (1119/8081 portlar) yo'naltiradi va o'z-o'zidan imzolangan
sertifikatni qabul qiladi. Bu — TrinityCore jamoasi rasmiy qo'llab-quvvatlamaydigan,
alohida community vositasi bo'lgani uchun, uni qanday sozlashni
TrinityCore forum/wiki manbalaridan (masalan "TrinityCore BfA client
connection" bo'yicha) o'zingiz tekshirib, ishonchli manbadan olishingizni
tavsiya qilaman.

---

## 8. Serverga joylashtirish (production deploy)

Docker mahalliy kompyuteringizda ishlamasa, buni Linux VPS/serverda ishga
tushirish odatda **yanada barqarorroq va oson** bo'ladi (Docker Desktop kabi
GUI-qatlam kerak emas). Qadamlar (Ubuntu/Debian server misolida):

### 8.1. Docker o'rnatish

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# keyin terminalga qayta kiring (yoki: newgrp docker)
```

Compose plugin odatda shu bilan birga o'rnatiladi (`docker compose version`
bilan tekshiring).

### 8.2. Loyihani serverga ko'chirish

```bash
git clone <sizning-repo-manzilingiz> bfa-uzbek-comunity
cd bfa-uzbek-comunity
```

(yoki `scp -r` bilan mahalliy papkani serverga ko'chiring)

### 8.3. Sozlash

```bash
cp .env.example .env
nano .env   # yoki boshqa tahrirlovchi
```

`.env` da albatta o'zgartiring:

- `DB_PASSWORD` — kuchli, tasodifiy parol
- `SESSION_SECRET` — kuchli, tasodifiy qiymat
- `SERVER_EXTERNAL_ADDRESS` — serveringizning **haqiqiy tashqi IP manzili**
  (yoki domeni)
- `ADMIN_LOGIN` / `ADMIN_PASSWORD` — admin akkauntingiz (§5 ga qarang)

### 8.4. Firewall

Faqat kerakli portlarni oching (masalan `ufw` bilan):

```bash
sudo ufw allow 22/tcp      # SSH (agar hali yo'q bo'lsa)
sudo ufw allow 8086/tcp    # veb-sayt
sudo ufw allow 1119/tcp    # bnetserver (Battle.net login)
sudo ufw allow 8081/tcp    # bnetserver (REST login)
sudo ufw allow 8085/tcp    # worldserver (worldserverni ishlatsangiz)
sudo ufw enable
```

`3306` (MySQL) portini **hech qachon** tashqi internetga ochmang — u faqat
konteynerlar ichida kerak.

### 8.5. Ishga tushirish

```bash
docker compose up -d --build mysql bnetserver web
```

(Kompilyatsiya birinchi marta 30–90+ daqiqa davom etishi mumkin — server
ssh ulanishini uzib qo'ymasligi uchun `tmux`/`screen` ichida ishga
tushirishni tavsiya qilaman: `tmux new -s deploy`.)

Tayyor bo'lgach, sayt `http://<server-ip>:8086` da ochiladi. Konteynerlar
`restart: unless-stopped` bilan sozlangan — server qayta yuklansa ham
avtomatik qayta ishga tushadi (agar Docker xizmati ham avtomatik
boshlanadigan qilib sozlangan bo'lsa: `sudo systemctl enable docker`).

### 8.6. (Tavsiya) HTTPS va domen

Agar saytga domen bog'lasangiz, veb-saytni to'g'ridan-to'g'ri 8086 portda
ochish o'rniga **Nginx + Let's Encrypt (certbot)** orqali teskari proksi
(reverse proxy) qilib, `https://` bilan taqdim etish tavsiya etiladi — bu
alohida, standart Nginx/certbot sozlash jarayoni bo'lib, ushbu qo'llanma
doirasidan tashqarida.

---

## 9. Muammolarni bartaraf etish

- **Build juda uzoq/xotira yetmayapti** — `.env` dagi `BUILD_JOBS` qiymatini
  kamaytiring (masalan `2`).
- **Build paytida `TrinityCore needs OpenSSL version 1.0 ... but found too new
  version 3.0.x` xatosi** — bu ushbu core versiyasining o'zi OpenSSL 3.x ni
  qo'llab-quvvatlamasligidan (buni Ubuntu 22.04+ standart bilan o'rnatadi).
  `Dockerfile` ataylab **Ubuntu 20.04** (OpenSSL 1.1.1) asosida qurilgan -
  agar shu xatoni ko'rsangiz, `git pull` bilan eng so'nggi `Dockerfile`ni
  olganingizga va Docker eskirgan keshdan emas, qaytadan (`--build` bilan)
  qurilayotganiga ishonch hosil qiling.
- **bnetserver/worldserver qayta-qayta o'chib-yonyapti** — loglarni ko'ring:
  `docker compose logs --tail=100 bnetserver`. Ko'pincha bazaga ulanish
  yoki (worldserver uchun) `server-data/` bo'sh bo'lgani sabab bo'ladi.
- **Sayt "auth bazasiga ulanib bo'lmadi" deb chiqsa** — `bnetserver`
  birinchi marta bazani yaratib bo'lguncha biroz kuting (`docker compose
  logs -f bnetserver`); sayt avtomatik qayta urinib turadi.
- **Konfiguratsiyani qo'lda o'zgartirish** — `bnetserver.conf`/
  `worldserver.conf` fayllari mos Docker volume ichida (`bnetserver-etc`,
  `worldserver-etc`) birinchi ishga tushishda avtomatik yaratiladi va
  keyingi qayta ishga tushirishlarda saqlanib qoladi (o'zgartirishlaringiz
  yo'qolmaydi). Ko'rish uchun:
  ```bash
  docker compose exec bnetserver cat /opt/trinitycore/etc/bnetserver.conf
  ```

---

## 10. Xavfsizlik bo'yicha eslatmalar

- `.env` faylini hech qachon Git-ga qo'shmang (`.gitignore` da allaqachon bor).
- Production (haqiqiy foydalanuvchilar) uchun `DB_PASSWORD` va
  `SESSION_SECRET` qiymatlarini albatta kuchli, tasodifiy qiymatlarga
  almashtiring.
- `mysql` porti (3306) va boshqa portlarni tashqi internetga ochishdan oldin
  firewall/xavfsizlik devori sozlamalarini tekshiring.
- `ADMIN_LOGIN`/`ADMIN_PASSWORD` — faqat `.env` da, hech qachon Git-ga
  qo'shiladigan boshqa faylga yozmang (§5 ga qarang).
