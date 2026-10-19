CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_days (
  day TEXT PRIMARY KEY,
  minute INTEGER NOT NULL CHECK (minute >= 0 AND minute < 1440)
);
CREATE TABLE IF NOT EXISTS notification_deliveries (
  day TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (day, subscription_id),
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE
);
