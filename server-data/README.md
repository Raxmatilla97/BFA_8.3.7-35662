# server-data/

`worldserver` konteyneri shu papkani `/data` sifatida ko'radi (`docker-compose.yml`
dagi `WORLD_DATA_DIR`). To'liq ishlaydigan o'yin dunyosi uchun bu yerda quyidagi
pastki papkalar bo'lishi kerak:

```
server-data/
  dbc/       (yoki dbc/<locale>)
  maps/
  vmaps/
  mmaps/
```

## Bu fayllarni qayerdan olish kerak?

Bu fayllar **Blizzard Entertainment ga tegishli mualliflik huquqi bilan
himoyalangan o'yin ma'lumotlari** bo'lgani uchun ular ushbu repozitoriyda yo'q
va men (Claude) ularni siz uchun yarata olmayman/yuklab bera olmayman. Ularni
faqat **qonuniy ravishda sotib olingan WoW (8.3.7, build 26972/26xxx) mijozi**
orqali o'zingiz hosil qilishingiz kerak:

1. `docker compose build tools` — TrinityCore manba kodidagi asboblarni
   (`mapextractor`, `vmap4extractor`, `vmap4assembler`, `mmaps_generator`)
   quradi.
2. WoW mijozi papkasini konteynerga ulab, asboblarni tartibda ishga tushiring
   (Windows PowerShell'da `$(pwd)` o'rniga to'liq yo'lni yozing):

   ```bash
   docker compose run --rm \
     -v "/path/to/WoW/8.3.7/client:/client" \
     -w /client \
     tools \
     -c "mapextractor && vmap4extractor && vmap4assembler vmaps /data/vmaps && mmaps_generator"
   ```

   (Aniq buyruqlar va bayroqlar TrinityCore rasmiy wiki-sidagi
   "Extracting Data From The WoW Client" bo'limida tavsiflangan — mijoz
   versiyasiga qarab bir oz farq qilishi mumkin. Har bir asbob natijani
   joriy papkaga yozadi, shuning uchun `dbc`/`maps`/`vmaps`/`mmaps`
   papkalarini oxirida `/data` ga ko'chiring: `mv dbc maps vmaps mmaps /data/`.)

3. Natijada hosil bo'lgan `dbc/`, `maps/`, `vmaps/`, `mmaps/` papkalarini shu
   `server-data/` papkasi ichiga joylashtiring.

## "world" va "hotfixes" bazalari haqida

`sql/base/dev/world_database.sql` va `sql/base/dev/hotfixes_database.sql`
fayllari faqat bazaning **tuzilishini** (bo'sh jadvallar) yaratadi — ichida
NPC, quest, item va boshqa o'yin kontenti yo'q. To'liq kontent uchun ushbu
kor versiyasiga mos **TDB (TrinityCore Database)** dump faylini alohida
topib, `world` va `hotfixes` bazalariga import qilishingiz kerak. Bu ham
katta hajmli (yuzlab MB) tashqi fayl bo'lgani uchun ushbu repoga kiritilmagan.

Bularsiz ham `bnetserver` + veb-sayt (ro'yxatdan o'tish/kirish/profil) to'liq
ishlaydi — faqat haqiqiy o'yin dunyosiga kirish (worldserver) uchun yuqoridagi
fayllar kerak bo'ladi.
