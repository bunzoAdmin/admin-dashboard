export const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Validates the raw polygon textarea input: one "lat,lng" pair per line.
// Returns null if valid (including empty input, which is allowed), or an
// error message string describing the first problem found.
export function validatePolygonLines(raw: string): string | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null; // optional
  if (lines.length < 3) return `Polygon needs at least 3 points (got ${lines.length}).`;
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length !== 2) return `Line "${line}" must be "lat,lng".`;
    const [latS, lngS] = parts.map((p) => p.trim());
    const lat = Number(latS);
    const lng = Number(lngS);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) return `Line "${line}" has an invalid latitude.`;
    if (Number.isNaN(lng) || lng < -180 || lng > 180) return `Line "${line}" has an invalid longitude.`;
  }
  return null;
}
