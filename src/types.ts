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
    /**
     * Dersin DEU Ders Katalogu'ndaki sayfasi. Kullaniciya kanit olarak
     * gosterilir: iddia bizim degil, katalogun.
     */
    source?: string
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
    /** Programin katalogdaki sayfasi; kanit baglantisi. */
    source?: string
    /** Yalnizca zincire katilan dersler: on kosulu olanlar ve on kosul olanlar. */
    courses: Course[]
}

/**
 * Bir ogretim plani surumu.
 *
 * Ayni plan birkac yil ust uste yayinlanabiliyor (Insaat 2012 ve 2014 birebir
 * ayniydi); bu durumda tek kayit tutulur ve `validTo` ile aralik verilir.
 */
export interface PlanVersion {
    /** Surumun yururluge girdigi ogretim yili (2016 = 2016-2017). */
    validFrom: number
    /** Bir sonraki surumden onceki son yil; en gunceli icin null. */
    validTo: number | null
    label: string
    /**
     * Ders + onkosul kumesinin ozeti. Ayni surumleri birlestirmek icin
     * uretilir; arayuzde kullanilmaz.
     */
    fingerprint: string
    /** Bu surumun alindigi ogretim plani PDF'i; kanit baglantisi. */
    source: string
    courses: Course[]
}

/** Bir programin tum plan surumleri. Yalnizca arsivi olan bolumlerde vardir. */
export interface ProgramPlans {
    id: string
    name: string
    /** Eskiden yeniye sirali. */
    versions: PlanVersion[]
}

export interface DataIndex {
    catalogYear: string
    source: string
    /** Verinin uretildigi tarih (ISO). Sayfada "son guncelleme" olarak gosterilir. */
    generatedAt: string
    programs: ProgramMeta[]
}
