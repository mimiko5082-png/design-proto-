-- Public photo board. Capability tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS photo_members (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS public_photos (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES photo_members(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  image TEXT NOT NULL,
  caption TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(member_id, day)
);
CREATE INDEX IF NOT EXISTS public_photos_day ON public_photos(day, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS photo_stamps (
  photo_id TEXT NOT NULL REFERENCES public_photos(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES photo_members(id) ON DELETE CASCADE,
  stamp TEXT NOT NULL,
  PRIMARY KEY(photo_id, member_id, stamp)
);
CREATE TABLE IF NOT EXISTS photo_comments (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL REFERENCES public_photos(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES photo_members(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photo_comments_photo ON photo_comments(photo_id, created_at);
CREATE TABLE IF NOT EXISTS photo_reports (
  photo_id TEXT NOT NULL REFERENCES public_photos(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES photo_members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(photo_id, member_id)
);
