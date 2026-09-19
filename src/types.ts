/**
 * Ince veri modeli.
 *
 * Bu uygulama transkript islemez ve not tutmaz; yalnizca katalogun on kosul
 * bilgisini gosterir. Bu yuzden ders kaydinda kredi, AKTS, tur gibi alanlar
 * yok: zincire katilan derslerin kodu, adi ve yariyili yeterli.
 */

/** Tek bir on kosul kaydi. `code` bos olabilir (katalogdaki serbest metin). */
export interface Prerequisite {
    code: string
    name: string
}

export interface Course {
    code: string
    name: string
    /** Donem veya yil numarasi. Katalogda yoksa null. */
    term: number | null
    /** On kosul yoksa bos dizi. */
    prerequisites: Prerequisite[]
}

export interface ProgramMeta {
    id: string
    name: string
    faculty: string
    level: string
    levelLabel: string
    /**
     * Ders KODU verilmis on kosulu olan ders sayisi. Zinciri bunlar kurar.
     */
    prereqCount: number
    /**
     * On kosulu serbest metin olan ders sayisi (orn. "HAZIRLIK SINIFI").
     * Gercek bir sart ama makineyle zincire baglanamaz; kullaniciya not
     * olarak gosterilir.
     */
    noteCount: number
    /** Tek bir dersten kalmanin kilitleyebilecegi en fazla ders sayisi. */
    maxLocked: number
}

export interface ProgramChain {
    id: string
    name: string
    faculty: string
    levelLabel: string
    catalogYear: string
    /** Yalnizca zincire katilan dersler: on kosulu olanlar ve on kosul olanlar. */
    courses: Course[]
}

export interface DataIndex {
    catalogYear: string
    source: string
    /** Verinin uretildigi tarih (ISO). Sayfada "son guncelleme" olarak gosterilir. */
    generatedAt: string
    programs: ProgramMeta[]
}
