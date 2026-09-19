/**
 * Giris yili -> ogretim plani surumu.
 *
 * ONEMLI SINIR: DEU'nun "ogrenci giris yilinin planina tabidir" diye yazili
 * bir kurali bulunamadi. Muafiyet ve Intibak Yonergesi yatay gecis ve disaridan
 * alinan dersler icindir, plan surumu degisikligini duzenlemiyor.
 *
 * Bu yuzden urun "SENIN GIRIS YILINDA YURURLUKTE OLAN PLAN BUYDU" der,
 * "sana bu plan uygulanir" DEMEZ. Ikincisi dogrulanmamis bir iddia olur.
 */

import type { PlanVersion, ProgramPlans } from '../types'

/** Katalogun devraldigi ilk yil. tools/import-archive.ts ile ayni deger. */
export const CATALOG_FROM = 2024

export type PlanChoice =
    /** Arsivde o yila ait surum var. */
    | { kind: 'archive'; version: PlanVersion }
    /** Yil katalog donemine dusuyor; guncel katalog verisi kullanilir. */
    | { kind: 'catalog' }
    /** Bu bolumun arsivi yok ya da yil arsivin disinda; katalog + uyari. */
    | { kind: 'unknown' }

/**
 * `entryYear` yilinda yururlukte olan plan surumu.
 *
 * `plans` null ise (bolumun arsivi yok) daima 'catalog' ya da 'unknown' doner.
 */
export function planForYear(
    plans: ProgramPlans | null,
    entryYear: number,
): PlanChoice {
    if (entryYear >= CATALOG_FROM) return { kind: 'catalog' }
    if (!plans || plans.versions.length === 0) return { kind: 'unknown' }

    const hit = plans.versions.find(
        (v) => entryYear >= v.validFrom && (v.validTo === null || entryYear <= v.validTo),
    )
    if (hit) return { kind: 'archive', version: hit }

    // Arsivin basladigi yildan once girmis. Bu kadar eski bir ogrenciye
    // elimizdeki en eski plani "senin planin" diye gostermek yanlis olur.
    return { kind: 'unknown' }
}

/**
 * Sihirbazin yil adiminda gosterilecek secenekler.
 *
 * Arsivin ilk yilindan bu yila kadar, yeniden eskiye. Arsiv yoksa bos dizi
 * doner ve arayuz yil adimini atlar.
 */
export function entryYearOptions(
    plans: ProgramPlans | null,
    currentYear: number = new Date().getFullYear(),
): number[] {
    if (!plans || plans.versions.length === 0) return []
    const first = plans.versions[0].validFrom
    const out: number[] = []
    for (let y = currentYear; y >= first; y -= 1) out.push(y)
    return out
}
