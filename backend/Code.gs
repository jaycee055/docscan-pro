/**
 * DocScan Pro: free accounts and backup, running in YOUR Google account.
 *
 * - Accounts (email + scrambled password) are kept in a Google Sheet that this script creates.
 * - Each person's backed-up scans go into their own sub-folder of "DocScan Pro Backups" in your Drive.
 * - Nobody can see anyone else's files. Passwords are never stored, only salted hashes.
 *
 * Setup (once): see backend/SETUP.md. In short: paste this file into a new Apps Script project,
 * run `setup`, then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 */

// ---- Limits that protect your Google storage (change if you like) ----
const PER_USER_QUOTA_MB = 200;        // each person can back up this much
const STOP_WHEN_DRIVE_PERCENT = 85;   // refuse new uploads when your Drive is this full
const MAX_SIGNUPS_PER_DAY = 50;
const MAX_FAILED_LOGINS = 5;          // per email, per 15 minutes
const SESSION_DAYS = 60;
const HASH_ROUNDS = 3000;

// ---------------------------------------------------------------------
function setup() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('ROOT_FOLDER');
  if (!folderId) { folderId = DriveApp.createFolder('DocScan Pro Backups').getId(); props.setProperty('ROOT_FOLDER', folderId); }
  let sheetId = props.getProperty('SHEET');
  if (!sheetId) {
    const ss = SpreadsheetApp.create('DocScan Pro Users');
    const users = ss.getSheets()[0]; users.setName('users');
    users.appendRow(['id', 'email', 'name', 'salt', 'hash', 'created', 'usedBytes', 'lastLogin']);
    ss.insertSheet('sessions').appendRow(['token', 'userId', 'created', 'expires']);
    DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(folderId));
    sheetId = ss.getId(); props.setProperty('SHEET', sheetId);
  }
  Logger.log('Ready. Backups folder: https://drive.google.com/drive/folders/' + folderId);
  Logger.log('User list: https://docs.google.com/spreadsheets/d/' + sheetId);
}

function doGet() { return out({ ok: true, app: 'DocScan Pro backend' }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const fn = ACTIONS[req.action];
    if (!fn) return out({ ok: false, error: 'unknown_action' });
    return out(fn(req));
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

const ACTIONS = {
  signup(req) {
    const email = cleanEmail(req.email), name = String(req.name || '').slice(0, 60).trim();
    if (!email) return fail('invalid_email');
    if (String(req.password || '').length < 8) return fail('weak_password');
    if (!req.consent) return fail('consent_required');
    return withLock(() => {
      const day = 'signups_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd');
      const cache = CacheService.getScriptCache(), n = Number(cache.get(day) || 0);
      if (n >= MAX_SIGNUPS_PER_DAY) return fail('signups_full_today');
      if (findUser(email)) return fail('email_taken');
      const salt = Utilities.getUuid(), id = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
      sheet('users').appendRow([id, email, name, salt, hashPw(req.password, salt), new Date(), 0, new Date()]);
      cache.put(day, String(n + 1), 21600 * 4);
      userFolder(id);
      return { ok: true, token: newSession(id), user: { email, name, usedBytes: 0, quotaBytes: quota() } };
    });
  },

  login(req) {
    const email = cleanEmail(req.email);
    if (!email) return fail('wrong_login');
    const cache = CacheService.getScriptCache(), k = 'fail_' + email, n = Number(cache.get(k) || 0);
    if (n >= MAX_FAILED_LOGINS) return fail('too_many_attempts');
    const u = findUser(email);
    if (!u || hashPw(req.password || '', u.salt) !== u.hash) { cache.put(k, String(n + 1), 900); return fail('wrong_login'); }
    cache.remove(k);
    sheet('users').getRange(u.row, 8).setValue(new Date());
    return { ok: true, token: newSession(u.id), user: publicUser(u) };
  },

  logout(req) { const s = findSession(req.token); if (s) sheet('sessions').deleteRow(s.row); return { ok: true }; },

  me(req) { const u = auth(req); return { ok: true, user: publicUser(u) }; },

  deleteAccount(req) {
    const u = auth(req);
    if (hashPw(req.password || '', u.salt) !== u.hash) return fail('wrong_password');
    return withLock(() => {
      userFolder(u.id).setTrashed(true);
      const ss = sheet('sessions'), rows = ss.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) if (rows[i][1] === u.id) ss.deleteRow(i + 1);
      sheet('users').deleteRow(findUser(u.email).row);
      return { ok: true };
    });
  },

  list(req) {
    const u = auth(req), docs = [], it = userFolder(u.id).getFolders();
    while (it.hasNext()) {
      const f = it.next(), m = f.getFilesByName('doc.json');
      if (m.hasNext()) { try { docs.push(JSON.parse(m.next().getBlob().getDataAsString())); } catch (e) {} }
    }
    return { ok: true, docs, user: publicUser(u) };
  },

  putFile(req) {
    const u = auth(req), name = safeName(req.name), docId = safeName(req.docId);
    const bytes = Utilities.base64Decode(req.b64 || '');
    return withLock(() => {
      if (driveTooFull()) return fail('server_storage_full');
      const folder = docFolder(u.id, docId), old = removeFile(folder, name);
      const used = Number(findUser(u.email).usedBytes || 0) - old + bytes.length;
      if (used > quota()) return fail('quota_full');
      folder.createFile(Utilities.newBlob(bytes, req.mime || 'image/jpeg', name));
      setUsed(u.email, used);
      return { ok: true, usedBytes: used };
    });
  },

  putMeta(req) {
    const u = auth(req), docId = safeName(req.docId), json = JSON.stringify(req.meta || {});
    if (json.length > 2e6) return fail('meta_too_big');
    return withLock(() => {
      const folder = docFolder(u.id, docId); removeFile(folder, 'doc.json');
      folder.createFile('doc.json', json, 'application/json');
      return { ok: true };
    });
  },

  getFile(req) {
    const u = auth(req), it = docFolder(u.id, safeName(req.docId)).getFilesByName(safeName(req.name));
    if (!it.hasNext()) return fail('not_found');
    const b = it.next().getBlob();
    return { ok: true, b64: Utilities.base64Encode(b.getBytes()), mime: b.getContentType() };
  },

  deleteDoc(req) {
    const u = auth(req), docId = safeName(req.docId);
    return withLock(() => {
      const it = userFolder(u.id).getFoldersByName(docId);
      if (!it.hasNext()) return { ok: true };
      const f = it.next(); let size = 0; const files = f.getFiles();
      while (files.hasNext()) { const x = files.next(); if (x.getName() !== 'doc.json') size += x.getSize(); }
      f.setTrashed(true);
      const used = Math.max(0, Number(findUser(u.email).usedBytes || 0) - size); setUsed(u.email, used);
      return { ok: true, usedBytes: used };
    });
  },
};

// ---------------------------------------------------------------------
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail(code) { return { ok: false, error: code }; }
function quota() { return PER_USER_QUOTA_MB * 1024 * 1024; }
function prop(k) { const v = PropertiesService.getScriptProperties().getProperty(k); if (!v) throw new Error('not_set_up'); return v; }
function sheet(name) { return SpreadsheetApp.openById(prop('SHEET')).getSheetByName(name); }
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function cleanEmail(e) { e = String(e || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length < 120 ? e : ''; }
function safeName(s) { s = String(s || ''); if (!/^[A-Za-z0-9._-]{1,80}$/.test(s)) throw new Error('bad_name'); return s; }
function hashPw(pw, salt) {
  let h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
  for (let i = 0; i < HASH_ROUNDS; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(Utilities.newBlob(salt).getBytes()));
  return Utilities.base64Encode(h);
}
function findUser(email) {
  const rows = sheet('users').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][1] === email)
    return { row: i + 1, id: rows[i][0], email: rows[i][1], name: rows[i][2], salt: rows[i][3], hash: rows[i][4], usedBytes: rows[i][6] };
  return null;
}
function findUserById(id) {
  const rows = sheet('users').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] === id) return findUser(rows[i][1]);
  return null;
}
function publicUser(u) { return { email: u.email, name: u.name, usedBytes: Number(u.usedBytes || 0), quotaBytes: quota() }; }
function setUsed(email, used) { sheet('users').getRange(findUser(email).row, 7).setValue(used); }
function newSession(userId) {
  const token = Utilities.getUuid() + Utilities.getUuid(), now = new Date();
  sheet('sessions').appendRow([token, userId, now, new Date(now.getTime() + SESSION_DAYS * 864e5)]);
  return token;
}
function findSession(token) {
  if (!token) return null;
  const rows = sheet('sessions').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] === token) return { row: i + 1, userId: rows[i][1], expires: rows[i][3] };
  return null;
}
function auth(req) {
  const s = findSession(req.token);
  if (!s || new Date(s.expires) < new Date()) throw new Error('signed_out');
  const u = findUserById(s.userId); if (!u) throw new Error('signed_out');
  return u;
}
function userFolder(id) {
  const root = DriveApp.getFolderById(prop('ROOT_FOLDER')), it = root.getFoldersByName('u_' + id);
  return it.hasNext() ? it.next() : root.createFolder('u_' + id);
}
function docFolder(userId, docId) {
  const uf = userFolder(userId), it = uf.getFoldersByName(docId);
  return it.hasNext() ? it.next() : uf.createFolder(docId);
}
function removeFile(folder, name) {
  let size = 0; const it = folder.getFilesByName(name);
  while (it.hasNext()) { const f = it.next(); size += f.getSize(); f.setTrashed(true); }
  return size;
}
function driveTooFull() {
  const limit = DriveApp.getStorageLimit();
  return limit > 0 && DriveApp.getStorageUsed() / limit * 100 >= STOP_WHEN_DRIVE_PERCENT;
}
