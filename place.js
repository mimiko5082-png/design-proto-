// Public locations are deliberately rounded before storage or rendering.
export function normalizePlace(value) {
  if (!value || typeof value.lat !== "number" || typeof value.lng !== "number"
      || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)
      || Math.abs(value.lat) > 85 || Math.abs(value.lng) > 180) return null;
  return { lat: Math.round(value.lat * 1000) / 1000, lng: Math.round(value.lng * 1000) / 1000 };
}
export function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad, dlng = (b.lng - a.lng) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function project(p) {
  const sin = Math.sin(p.lat * Math.PI / 180), size = 256 * 2 ** 15;
  return { x: (p.lng + 180) / 360 * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}
export function mapGeometry(center, entries) {
  const c = project(normalizePlace(center));
  const tileX = Math.floor(c.x / 256), tileY = Math.floor(c.y / 256);
  const left = (tileX - 1) * 256, top = (tileY - 1) * 256, size = 2 ** 15;
  const tiles = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const y = tileY - 1 + row;
    if (y >= 0 && y < size) tiles.push({ x: ((tileX - 1 + col) % size + size) % size, y, left: col * 256, top: row * 256 });
  }
  const pins = entries.flatMap(entry => {
    const place = normalizePlace(entry.place);
    if (!place) return [];
    const p = project(place);
    let dx = p.x - left;
    if (dx > 256 * size / 2) dx -= 256 * size;
    if (dx < -256 * size / 2) dx += 256 * size;
    const x = dx / 768 * 100, y = (p.y - top) / 768 * 100;
    return x >= 0 && x <= 100 && y >= 0 && y <= 100 ? [{ id: entry.id, title: entry.title, x, y }] : [];
  });
  return { tiles, pins };
}
