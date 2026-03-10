/**
 * Parse bank_transfer_image field which may be:
 * - A JSON array string: '["url1","url2"]'
 * - A single URL string: 'https://...'
 * - Empty/null
 * Returns an array of URLs.
 */
export const parseBankTransferImages = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    return [raw];
  } catch {
    return raw ? [raw] : [];
  }
};
