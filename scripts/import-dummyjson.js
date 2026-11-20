import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(root, 'data');
const databasePath = path.join(dataDirectory, 'coy.sqlite');

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

await fs.mkdir(dataDirectory, { recursive: true });

const response = await fetch('https://dummyjson.com/users?limit=32');
if (!response.ok) {
  throw new Error(`DummyJSON request failed with status ${response.status}`);
}

const payload = await response.json();
if (!Array.isArray(payload.users) || payload.users.length < 30) {
  throw new Error('DummyJSON did not return at least 30 users');
}

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
`);

const alreadyLiked = new Set([2, 7, 13, 21, 29]);
const insertProfile = database.prepare(`
  INSERT OR REPLACE INTO profiles
  (id, name, age, photo, bio, city, interests, liked_by_demo)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

database.exec('BEGIN');
database.exec('DELETE FROM swipes');
database.exec('DELETE FROM profiles');

for (const [index, user] of payload.users.slice(0, 32).entries()) {
  insertProfile.run(
    `dummy-${user.id}`,
    `${user.firstName} ${user.lastName}`,
    user.age,
    user.image,
    bios[index % bios.length],
    user.address?.city || user.address?.country || 'Unknown',
    JSON.stringify(interests[index % interests.length]),
    alreadyLiked.has(index + 1) ? 1 : 0
  );
}

database.exec('COMMIT');
database.close();

console.log(`Imported ${payload.users.slice(0, 32).length} DummyJSON profiles into ${databasePath}`);
