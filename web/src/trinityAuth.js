'use strict';

/**
 * TrinityCore (BfA 8.3.7 / bnetserver) bilan 100% mos keladigan
 * autentifikatsiya matematikasi (SRP6 + Battle.net SHA256 parol xeshi).
 *
 * Bu fayldagi har bir qadam quyidagi asl C++ manbalardan aynan ko'chirilgan
 * (baytma-bayt mosligini ta'minlash uchun):
 *   - src/common/Cryptography/Authentication/SRP6.cpp
 *   - src/common/Cryptography/BigNumber.cpp
 *   - src/common/Utilities/Util.cpp (Utf8ToUpperOnlyLatin, ByteArrayToHexStr)
 *   - src/server/game/Accounts/BattlenetAccountMgr.cpp (CalculateShaPassHash)
 *   - src/server/game/Accounts/AccountMgr.cpp (CreateAccount)
 *
 * Shu tufayli bu veb-sayt orqali yaratilgan akkauntlar aslida ishlaydigan
 * bnetserver/worldserver bilan to'liq mos (haqiqiy WoW mijozi ular bilan
 * kira oladi), chunki parol/xesh hisoblash algoritmi serverdagi bilan aynan bir xil.
 */

const crypto = require('crypto');

// SRP6::N  (src/common/Cryptography/Authentication/SRP6.cpp)
// Hex satr HexStrToByteArray<32>(hex, /*reverse=*/true) orqali baytlarga,
// so'ng BigNumber(array, /*littleEndian=*/true) orqali songa aylantiriladi -
// ikkala teskari amal bir-birini bekor qiladi, natijada bu oddiy katta-endian
// hex son bilan bir xil bo'ladi.
const N = BigInt(
  '0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7'
);
// SRP6::g
const G = 7n;

const SALT_LENGTH = 32;
const VERIFIER_LENGTH = 32;

/**
 * Util.h: isBasicLatinCharacter() faqat ASCII a-z / A-Z ni "lotin" deb hisoblaydi.
 * wcharToUpperOnlyLatin() ham faqat shu diapazonni katta harfga o'tkazadi,
 * qolgan hamma narsa (raqamlar, belgilar, kirill, o'zbekcha ў/қ va h.k.) o'zgarishsiz qoladi.
 * Utf8ToUpperOnlyLatin(std::string&) shu funksiyani har bir belgiga qo'llaydi.
 */
function utf8ToUpperOnlyLatin(str) {
  let out = '';
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code >= 0x61 && code <= 0x7a) {
      out += String.fromCharCode(code - 0x20);
    } else {
      out += ch;
    }
  }
  return out;
}

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest();
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

// Util.cpp: ByteArrayToHexStr(bytes, len, reverse=false) -> "%02X" ketma-ket
function bytesToHexUpper(buf) {
  return Buffer.from(buf).toString('hex').toUpperCase();
}

// Util.cpp: ByteArrayToHexStr(bytes, len, reverse=true) -> baytlar OXIRIDAN
// BOSHIGA "%02X" bilan yoziladi, ya'ni bayt tartibi teskari qilingan hex.
function bytesToHexReversed(buf) {
  return Buffer.from(buf).reverse().toString('hex').toUpperCase();
}

// BigNumber little-endian bayt massividan BigInt ga (SetBinary littleEndian=true)
function bufferToBigIntLE(buf) {
  let result = 0n;
  for (let i = buf.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(buf[i]);
  }
  return result;
}

// BigInt dan BigNumber::GetBytes(..., littleEndian=true) uslubidagi,
// belgilangan uzunlikdagi (nol bilan to'ldirilgan) little-endian baytlarga
function bigIntToBufferLE(num, size) {
  const buf = Buffer.alloc(size);
  let n = num;
  for (let i = 0; i < size; i++) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

// Tez modular darajaga ko'tarish: base^exp mod mod
function modPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

/**
 * SRP6::CalculateVerifierFromHash / MakeRegistrationData
 * (SRP6.cpp) ning to'g'ridan-to'g'ri porti.
 *
 * MUHIM: username va password chaqiruvchi tomonidan avval
 * utf8ToUpperOnlyLatin() orqali o'tkazilgan bo'lishi kerak - xuddi
 * AccountMgr::CreateAccount ichida Utf8ToUpperOnlyLatin() chaqirilgani kabi.
 *
 * @returns {{ salt: Buffer(32), verifier: Buffer(32) }}
 */
function makeSrp6RegistrationData(usernameUpper, passwordUpper) {
  const salt = crypto.randomBytes(SALT_LENGTH); // Crypto::GetRandomBytes - xom baytlar, aylantirish yo'q

  // H(I) o'rniga bu yerda H(U:P) kerak - SRP6::CalculateVerifier:
  //   SHA1::GetDigestOf(username, ":", password)
  const credHash = sha1(Buffer.from(`${usernameUpper}:${passwordUpper}`, 'utf8'));

  // SRP6::CalculateVerifierFromHash: SHA1::GetDigestOf(salt, hash)
  const expDigest = sha1(Buffer.concat([salt, credHash]));
  const exponent = bufferToBigIntLE(expDigest);

  // v = g ^ exponent mod N
  const v = modPow(G, exponent, N);
  const verifier = bigIntToBufferLE(v, VERIFIER_LENGTH);

  return { salt, verifier };
}

/**
 * Battlenet::AccountMgr::CalculateShaPassHash (BattlenetAccountMgr.cpp) porti.
 *
 * MUHIM: email va password chaqiruvchi tomonidan avval
 * utf8ToUpperOnlyLatin() orqali o'tkazilgan bo'lishi kerak (bnetserver ham
 * shunday qiladi - CreateBattlenetAccount ichida).
 *
 * @returns {string} 64 ta hex belgidan iborat, katta harfli sha_pass_hash
 */
function calculateBnetShaPassHash(emailUpper, passwordUpper) {
  const emailDigest = sha256(Buffer.from(emailUpper, 'utf8'));
  const emailHex = bytesToHexUpper(emailDigest);
  const finalDigest = sha256(Buffer.from(`${emailHex}:${passwordUpper}`, 'utf8'));
  return bytesToHexReversed(finalDigest);
}

module.exports = {
  N,
  G,
  utf8ToUpperOnlyLatin,
  makeSrp6RegistrationData,
  calculateBnetShaPassHash,
};
