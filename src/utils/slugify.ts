/**
 * Converts a free-text tournament name to a URL-safe slug.
 * "Padel Palooza 2026" → "padel-palooza-2026"
 * "padelpalooza"       → "padelpalooza"
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip special chars
    .replace(/\s+/g, '-')            // spaces → dashes
    .replace(/-+/g, '-')             // collapse multiple dashes
    .replace(/^-|-$/g, '');          // trim leading/trailing dashes
}

/** Returns true if a slug is valid (non-empty, URL-safe). */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || /^[a-z0-9]$/.test(slug);
}
