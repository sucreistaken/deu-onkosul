/**
 * Ders kodunu adres parcasina cevirir: "İNŞ 1012" -> "ins-1012".
 *
 * Neden encodeURIComponent degil: adres hem paylasilabilir hem aranabilir
 * olmali. "%C4%B0N%C5%9E%201012" ikisini de bozar.
 *
 * Kayipli bir donusum: geri cevirmek yerine programin ders listesinde
 * slug'i eslesen kod aranir (bkz. findByslug).
 */

const TR: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', I: 'i', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
}

export const slugify = (code: string): string =>
    code
        .split('')
        .map((ch) => TR[ch] ?? ch)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

/** Slug'a karsilik gelen ders kodunu bulur; yoksa null. */
export const findBySlug = (codes: string[], slug: string): string | null =>
    codes.find((c) => slugify(c) === slug) ?? null
