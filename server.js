import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const app = express();
const port = process.env.PORT || 3001;
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(root, 'data');
const databasePath = path.join(dataDirectory, 'coy.sqlite');
const legacyStatePath = path.join(dataDirectory, 'state.json');
const adminSessions = new Map();

const names = [
  ['Aarav', 'Mehta'], ['Aanya', 'Shah'], ['Aditya', 'Rao'], ['Anika', 'Kapoor'],
  ['Arjun', 'Nair'], ['Diya', 'Iyer'], ['Kabir', 'Malhotra'], ['Kiara', 'Bose'],
  ['Mira', 'Joshi'], ['Neil', 'Patel'], ['Rhea', 'Singh'], ['Rohan', 'Das'],
  ['Sana', 'Khan'], ['Tara', 'Menon'], ['Vihaan', 'Bhat'], ['Zoya', 'Ali'],
  ['Ishaan', 'Verma'], ['Meera', 'Sethi'], ['Kavya', 'Pillai'], ['Dev', 'Chauhan'],
  ['Anaya', 'Kulkarni'], ['Yash', 'Agarwal'], ['Ira', 'Deshmukh'], ['Reyansh', 'Jain'],
  ['Nisha', 'Gupta'], ['Veer', 'Oberoi'], ['Myra', 'Saxena'], ['Atharv', 'Mishra'],
  ['Lavanya', 'Reddy'], ['Karan', 'Chopra'], ['Sia', 'Tiwari'], ['Ritvik', 'Sood']
];
const cities = ['Mumbai', 'Bengaluru', 'Delhi', 'Pune', 'Hyderabad', 'Chennai'];
const bios = [
  'Always looking for a new cafe and a good conversation.',
  'Building things by day, chasing sunsets by evening.',
  'Equal parts curious, kind, and competitive at board games.',
  'Here for thoughtful chats and spontaneous weekend plans.'
];
const interests = [
  ['Coffee', 'Photography', 'Travel'],
  ['Running', 'Music', 'Startups'],
  ['Books', 'Food', 'Design'],
  ['Hiking', 'Movies', 'Yoga']
];

const profiles = names.map(([first, last], index) => ({
  id: `profile-${index + 1}`,
  name: `${first} ${last}`,
  age: 21 + (index % 10),
  photo: `https://i.pravatar.cc/640?img=${(index % 70) + 1}`,
  bio: bios[index % bios.length],
  city: cities[index % cities.length],
  interests: interests[index % interests.length]
}));

app.use(express.json());

await fs.mkdir(dataDirectory, { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    photo TEXT NOT NULL,
    bio TEXT NOT NULL,
    city TEXT NOT NULL,
    interests TEXT NOT NULL,
    liked_by_demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS swipes (
    user_id TEXT NOT NULL,
    profile_id TEXT NOT NULL REFERENCES profiles(id),
    direction TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, profile_id)
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    age INTEGER NOT NULL,
    photo TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    bio TEXT NOT NULL DEFAULT '',
    interests TEXT NOT NULL DEFAULT '[]'
  );
`);

const userColumns = database.prepare('PRAGMA table_info(users)').all();
if (!userColumns.some((column) => column.name === 'role')) {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString('hex')
  };
}

function verifyPassword(password, salt, hash) {
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const stored = Buffer.from(hash, 'hex');
  const candidate = Buffer.from(actual, 'hex');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

// Existing imported profiles receive a usable demo account and a generated phone number.
const existingUsers = database.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (existingUsers === 0) {
  const profilesForUsers = database.prepare(
    'SELECT id, name, age, photo, city, bio, interests FROM profiles'
  ).all();
  const insertUser = database.prepare(`
    INSERT INTO users
    (id, name, phone, password_hash, password_salt, age, photo, city, bio, interests)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  database.exec('BEGIN');
  for (const [index, profile] of profilesForUsers.entries()) {
    const password = 'Coy@1234';
    const credentials = hashPassword(password);
    insertUser.run(
      `user-${profile.id}`,
      profile.name,
      `+91900000${String(index + 1).padStart(4, '0')}`,
      credentials.hash,
      credentials.salt,
      profile.age,
      profile.photo,
      profile.city,
      profile.bio,
      profile.interests
    );
  }
  database.exec('COMMIT');
}

const adminPhone = '+918755436784';
const existingAdmin = database.prepare('SELECT id FROM users WHERE phone = ?').get(adminPhone);
if (!existingAdmin) {
  const credentials = hashPassword('Admin@04');
  database.prepare(`
    INSERT INTO users
    (id, name, phone, password_hash, password_salt, age, photo, city, bio, interests, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')
  `).run(
    'admin-coy',
    'Kinly Administrator',
    adminPhone,
    credentials.hash,
    credentials.salt,
    30,
    '',
    'Administrative',
    'Kinly system administrator',
    '["Administration"]'
  );
} else {
  const credentials = hashPassword('Admin@04');
  database.prepare(`
    UPDATE users
    SET role='admin', password_hash=?, password_salt=?
    WHERE phone=?
  `).run(credentials.hash, credentials.salt, adminPhone);
}

const profileCount = database.prepare('SELECT COUNT(*) AS count FROM profiles').get().count;
if (profileCount === 0) {
  const insertProfile = database.prepare(`
    INSERT INTO profiles (id, name, age, photo, bio, city, interests, liked_by_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const alreadyLiked = new Set(['profile-2', 'profile-7', 'profile-13', 'profile-21', 'profile-29']);
  database.exec('BEGIN');
  for (const profile of profiles) {
    insertProfile.run(
      profile.id,
      profile.name,
      profile.age,
      profile.photo,
      profile.bio,
      profile.city,
      JSON.stringify(profile.interests),
      alreadyLiked.has(profile.id) ? 1 : 0
    );
  }
  database.exec('COMMIT');

  // Import the previous JSON state once, so existing local demos are not lost.
  try {
    const legacy = JSON.parse(await fs.readFile(legacyStatePath, 'utf8'));
    const insertSwipe = database.prepare(
      'INSERT OR IGNORE INTO swipes (user_id, profile_id, direction) VALUES (?, ?, ?)'
    );
    for (const profileId of legacy.swipes?.['demo-user'] || []) {
      const direction = legacy.matches?.includes(profileId) ? 'like' : 'pass';
      insertSwipe.run('demo-user', profileId, direction);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, phone, password, age, photo, city, latitude, longitude, bio, interests } = req.body;
    if (!name || !phone || !password || !age || !photo || !city) {
      return res.status(400).json({ error: 'Name, phone, password, age, photo, and location are required' });
    }
    if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }
    const score = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password)
    ].filter(Boolean).length;
    if (score < 5) {
      return res.status(400).json({ error: 'Password must include 8 characters, uppercase, lowercase, number, and symbol' });
    }
    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    const duplicate = database.prepare('SELECT id FROM users WHERE phone = ?').get(normalizedPhone);
    if (duplicate) return res.status(409).json({ error: 'An account already exists for this phone number' });

    const id = `user-${crypto.randomUUID()}`;
    const credentials = hashPassword(password);
    const userInterests = Array.isArray(interests) ? interests : [];
    database.prepare(`
      INSERT INTO users
      (id, name, phone, password_hash, password_salt, age, photo, city, latitude, longitude, bio, interests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name.trim(), normalizedPhone, credentials.hash, credentials.salt, Number(age),
      photo, city.trim(), latitude ? Number(latitude) : null, longitude ? Number(longitude) : null,
      (bio || '').trim(), JSON.stringify(userInterests)
    );
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, { userId: id, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    res.status(201).json({
      user: serializeUser(database.prepare('SELECT * FROM users WHERE id = ?').get(id)),
      token
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const normalizedPhone = (req.body.phone || '').replace(/[^\d+]/g, '');
    const user = database.prepare('SELECT * FROM users WHERE phone = ?').get(normalizedPhone);
    if (!user || !verifyPassword(req.body.password || '', user.password_salt, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, { userId: user.id, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    res.json({ user: serializeUser(user), token });
  } catch (error) {
    next(error);
  }
});

app.put('/api/profile', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const session = token ? adminSessions.get(token) : null;
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Please log in again' });
    }
    const { id, name, phone, age, photo, city, latitude, longitude, bio, interests } = req.body;
    if (session.userId !== id) {
      return res.status(403).json({ error: 'You can only edit your own profile' });
    }
    if (!id || !name || !phone || !age || !photo || !city) {
      return res.status(400).json({ error: 'Name, phone, age, photo, and location are required' });
    }
    if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }
    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    const duplicate = database.prepare('SELECT id FROM users WHERE phone = ? AND id != ?')
      .get(normalizedPhone, id);
    if (duplicate) return res.status(409).json({ error: 'Phone number is already in use' });
    const updated = database.prepare(`
      UPDATE users
      SET name=?, phone=?, age=?, photo=?, city=?, latitude=?, longitude=?, bio=?, interests=?
      WHERE id=?
    `).run(
      name.trim(), normalizedPhone, Number(age), photo, city.trim(),
      latitude ? Number(latitude) : null, longitude ? Number(longitude) : null,
      (bio || '').trim(), JSON.stringify(Array.isArray(interests) ? interests : []), id
    );
    if (!updated.changes) return res.status(404).json({ error: 'Profile not found' });
    res.json({ user: serializeUser(database.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  } catch (error) {
    next(error);
  }
});

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = token ? adminSessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  req.admin = serializeUser(user);
  next();
}

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  res.json({
    users: database.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    profiles: database.prepare('SELECT COUNT(*) AS count FROM profiles').get().count,
    swipes: database.prepare('SELECT COUNT(*) AS count FROM swipes').get().count,
    matches: database.prepare(`
      SELECT COUNT(*) AS count FROM profiles p
      INNER JOIN swipes s ON s.profile_id = p.id
      WHERE s.direction = 'like' AND p.liked_by_demo = 1
    `).get().count
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const query = (req.query.q || '').trim();
  let users;
  if (query) {
    const term = `%${query.toLowerCase()}%`;
    users = database.prepare(`
      SELECT id, name, phone, age, photo, city, latitude, longitude, bio, interests, role
      FROM users
      WHERE lower(name) LIKE ? OR lower(phone) LIKE ? OR lower(city) LIKE ? OR lower(role) LIKE ?
      ORDER BY name
      LIMIT 100
    `).all(term, term, term, term);
  } else {
    users = database.prepare(`
      SELECT id, name, phone, age, photo, city, latitude, longitude, bio, interests, role
      FROM users ORDER BY name LIMIT 100
    `).all();
  }
  res.json(users.map((user) => ({
    ...user,
    interests: typeof user.interests === 'string' ? JSON.parse(user.interests) : user.interests
  })));
});

/*
  The query stays in the SQL index path and avoids loading/serializing the
  full table for every keystroke.
*/
database.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
`);

app.put('/api/admin/users/:id', requireAdmin, (req, res, next) => {
  try {
    const existing = database.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const { name, phone, age, photo, city, latitude, longitude, bio, interests } = req.body;
    const duplicate = database.prepare('SELECT id FROM users WHERE phone = ? AND id != ?')
      .get(phone, req.params.id);
    if (duplicate) return res.status(409).json({ error: 'Phone number is already in use' });
    database.prepare(`
      UPDATE users SET name=?, phone=?, age=?, photo=?, city=?, latitude=?, longitude=?, bio=?, interests=?, role=?
      WHERE id=?
    `).run(
      name, phone.replace(/[^\d+]/g, ''), Number(age), photo, city,
      latitude ? Number(latitude) : null, longitude ? Number(longitude) : null, bio,
      JSON.stringify(Array.isArray(interests) ? interests : []),
      existing.role,
      req.params.id
    );
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === 'admin-coy') {
    return res.status(400).json({ error: 'The primary admin account cannot be deleted' });
  }
  database.prepare('DELETE FROM swipes WHERE user_id = ?').run(req.params.id);
  const deleted = database.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: deleted.changes > 0 });
});

app.get('/api/admin/users/:id/details', requireAdmin, (req, res) => {
  const account = database.prepare(`
    SELECT id, name, phone, age, photo, city, latitude, longitude, bio, interests, role
    FROM users WHERE id = ?
  `).get(req.params.id);
  if (!account) return res.status(404).json({ error: 'User not found' });
  const swipes = database.prepare(`
    SELECT s.profile_id, s.direction, s.created_at,
      p.name, p.age, p.photo, p.city
    FROM swipes s
    LEFT JOIN profiles p ON p.id = s.profile_id
    WHERE s.user_id = ? OR (s.user_id = 'demo-user' AND ? LIKE 'user-%')
    ORDER BY s.created_at DESC
  `).all(req.params.id, req.params.id);
  const matches = swipes.filter((swipe) =>
    swipe.direction === 'like' &&
    database.prepare('SELECT liked_by_demo FROM profiles WHERE id = ?').get(swipe.profile_id)?.liked_by_demo === 1
  );
  res.json({
    user: {
      ...account,
      interests: typeof account.interests === 'string' ? JSON.parse(account.interests) : account.interests
    },
    swipes,
    matches
  });
});

app.post('/api/admin/users/:id/reset-swipes', requireAdmin, (req, res) => {
  const deleted = database.prepare('DELETE FROM swipes WHERE user_id = ?').run(req.params.id);
  const legacy = req.params.id.startsWith('user-')
    ? database.prepare("DELETE FROM swipes WHERE user_id = 'demo-user'").run()
    : { changes: 0 };
  res.json({ success: true, resetCount: deleted.changes + legacy.changes });
});

app.delete('/api/admin/users/:id/swipes/:profileId', requireAdmin, (req, res) => {
  const deleted = database.prepare(
    'DELETE FROM swipes WHERE user_id = ? AND profile_id = ?'
  ).run(req.params.id, req.params.profileId);
  const legacy = req.params.id.startsWith('user-')
    ? database.prepare("DELETE FROM swipes WHERE user_id = 'demo-user' AND profile_id = ?").run(req.params.profileId)
    : { changes: 0 };
  res.json({ success: deleted.changes + legacy.changes > 0 });
});

app.get('/api/admin/profiles', requireAdmin, (req, res) => {
  const query = (req.query.q || '').trim();
  let profiles;
  if (query) {
    const term = `%${query.toLowerCase()}%`;
    profiles = database.prepare(`
      SELECT id, name, age, photo, bio, city, interests, liked_by_demo
      FROM profiles
      WHERE lower(name) LIKE ? OR lower(city) LIKE ? OR lower(bio) LIKE ?
      ORDER BY rowid LIMIT 100
    `).all(term, term, term);
  } else {
    profiles = database.prepare(`
      SELECT id, name, age, photo, bio, city, interests, liked_by_demo
      FROM profiles ORDER BY rowid LIMIT 100
    `).all();
  }
  res.json(profiles.map((profile) => ({ ...profile, interests: JSON.parse(profile.interests) })));
});

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);
  CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
`);

app.post('/api/admin/profiles', requireAdmin, (req, res, next) => {
  try {
    const { name, age, photo, bio, city, interests, liked_by_demo } = req.body;
    const id = `profile-${crypto.randomUUID()}`;
    database.prepare(`
      INSERT INTO profiles (id, name, age, photo, bio, city, interests, liked_by_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, Number(age), photo, bio, city, JSON.stringify(interests || []), liked_by_demo ? 1 : 0);
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

app.put('/api/admin/profiles/:id', requireAdmin, (req, res, next) => {
  try {
    const { name, age, photo, bio, city, interests, liked_by_demo } = req.body;
    const updated = database.prepare(`
      UPDATE profiles SET name=?, age=?, photo=?, bio=?, city=?, interests=?, liked_by_demo=? WHERE id=?
    `).run(name, Number(age), photo, bio, city, JSON.stringify(interests || []), liked_by_demo ? 1 : 0, req.params.id);
    res.json({ success: updated.changes > 0 });
  } catch (error) { next(error); }
});

app.delete('/api/admin/profiles/:id', requireAdmin, (req, res) => {
  database.prepare('DELETE FROM swipes WHERE profile_id = ?').run(req.params.id);
  const deleted = database.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
  res.json({ success: deleted.changes > 0 });
});

app.get('/api/auth/me', (req, res) => {
  res.status(501).json({ error: 'Session lookup is handled by the browser in this demo' });
});

function requireSession(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = token ? adminSessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Please log in again' });
  }
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!user) return res.status(401).json({ error: 'Please log in again' });
  req.currentUser = user;
  next();
}

app.get('/api/feed', requireSession, async (req, res, next) => {
  try {
    const feed = database.prepare(`
      SELECT id, name, age, photo, bio, city, interests
      FROM profiles
      WHERE id NOT IN (
        SELECT profile_id FROM swipes WHERE user_id = ?
      )
      ORDER BY rowid
    `).all(req.currentUser.id).map(deserializeProfile);
    res.json(feed);
  } catch (error) {
    next(error);
  }
});

app.post('/api/swipe', requireSession, async (req, res, next) => {
  try {
    const { profileId, direction } = req.body;
    if (!profileId || !['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'profileId and a valid direction are required' });
    }
    const profile = database.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const existingSwipe = database.prepare(
      'SELECT 1 FROM swipes WHERE user_id = ? AND profile_id = ?'
    ).get(req.currentUser.id, profileId);
    if (existingSwipe) {
      return res.status(409).json({ error: 'This profile has already been swiped on' });
    }
    database.prepare(
      'INSERT INTO swipes (user_id, profile_id, direction) VALUES (?, ?, ?)'
    ).run(req.currentUser.id, profileId, direction);
    const matched = direction === 'like' && profile.liked_by_demo === 1;
    res.json({ matched, profile: deserializeProfile(profile) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/matches', requireSession, async (req, res, next) => {
  try {
    const matches = database.prepare(`
      SELECT p.id, p.name, p.age, p.photo, p.bio, p.city, p.interests
      FROM profiles p
      INNER JOIN swipes s ON s.profile_id = p.id
      WHERE s.user_id = ? AND s.direction = 'like' AND p.liked_by_demo = 1
      ORDER BY s.created_at DESC
    `).all(req.currentUser.id).map(deserializeProfile);
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong while loading your discovery data' });
});

function serializeUser(user) {
  if (!user) return null;
  const { password_hash, password_salt, ...safeUser } = user;
  return {
    ...safeUser,
    interests: typeof safeUser.interests === 'string' ? JSON.parse(safeUser.interests) : safeUser.interests
  };
}

function deserializeProfile(profile) {
  return { ...profile, interests: JSON.parse(profile.interests) };
}

app.use(express.static(path.join(root, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(root, 'dist', 'index.html'));
});

app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
