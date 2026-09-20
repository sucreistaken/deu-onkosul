/**
 * Yariyil -> acilis donemi.
 *
 * Kural katalogla dogrulandi: 13.599 lisans dersinde SIFIR istisna.
 * Tek yariyil dersleri guz, cift yariyil dersleri bahar doneminde acilir.
 * (Her iki donem de acilan dersler bu testin disinda tutuldu.)
 *
 * Bu sayede arsivden gelen eski planlarda da donem gosterilebiliyor;
 * plan PDF'lerinde acilis donemi sutunu yok.
 */
export const termSeason = (term: number | null): 'guz' | 'bahar' | null =>
    term === null ? null : term % 2 === 1 ? 'guz' : 'bahar'

export const termLabel = (term: number | null): string => {
    const s = termSeason(term)
    return term === null ? '' : s === 'guz' ? `${term}. yariyil, guz` : `${term}. yariyil, bahar`
}
