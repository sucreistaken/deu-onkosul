/**
 * Onkosul grafigi.
 *
 * Kaynaklar:
 *  - Muhendislik Fakultesi Ogretim ve Sinav Uygulama Esaslari ver5 (30.09.2024)
 *      MADDE 6/5  : "Bir derse on sart olan ders veya dersler basarilmis
 *                    olmadikca o ders alinamaz." Istisnasi yok.
 *      MADDE 9/3  : Daha once alinmamis derse kayit icin en az 1.80 GNO.
 *                   Istisna: 1. ve 2. yariyil dersleri, ortak zorunlu dersler
 *                   (ATA/TDL/Yabanci Dil/Beden Egitimi/Guzel Sanatlar/ISG),
 *                   teknik olmayan sosyal secmeliler, ERA kodlu dersler ve
 *                   universite secmelileri.
 *      MADDE 26/4 : Yalniz AA..DD gecer; FD basarisizdir.
 *  - Onkosul verisi DEU Ders Katalogu'ndan gelir (Course.prerequisites).
 *
 * Saf fonksiyonlar; React'e ve store'a bagimli degil.
 */

import type { Course } from '../types'

// --------------------------------------------------------------------------
// Grafik
// --------------------------------------------------------------------------

export interface PrereqGraph {
    /** ders kodu -> o dersi onkosul olarak isteyen derslerin kodlari */
    dependents: Map<string, Set<string>>
    /** ders kodu -> kendi onkosul kodlari */
    requires: Map<string, Set<string>>
    /** ders kodu -> katalog kaydi (ayni kod birden fazla satirda olabilir, ilki) */
    byCode: Map<string, Course>
}

/**
 * Katalog derslerinden yonlu grafik kurar.
 *
 * Kodu bos onkosullar (katalogdaki serbest metin) grafige girmez; grafik
 * yalnizca makineyle cozulebilen bagimliliklari tasir.
 */
export function buildGraph(courses: Course[]): PrereqGraph {
    const dependents = new Map<string, Set<string>>()
    const requires = new Map<string, Set<string>>()
    const byCode = new Map<string, Course>()

    for (const course of courses) {
        if (!byCode.has(course.code)) byCode.set(course.code, course)
    }

    // Katalog, programin kendi ders listesinde OLMAYAN bir dersi onkosul
    // gosterebiliyor (orn. MMM 2402 MALZEME II -> MMZ 2001 MALZEME I, eski
    // koddan kalma). Bu dugumler zincirde yine gorunur; adlari onkosul
    // kaydindan alinmazsa ekranda "MMZ 2001 / MMZ 2001" diye cikar.
    for (const course of courses) {
        for (const pre of course.prerequisites ?? []) {
            if (!pre.code || byCode.has(pre.code)) continue
            byCode.set(pre.code, {
                code: pre.code,
                name: pre.name || pre.code,
                term: null,
                prerequisites: [],
            })
        }
    }

    for (const course of courses) {
        for (const pre of course.prerequisites ?? []) {
            if (!pre.code) continue

            let deps = dependents.get(pre.code)
            if (!deps) {
                deps = new Set()
                dependents.set(pre.code, deps)
            }
            deps.add(course.code)

            let reqs = requires.get(course.code)
            if (!reqs) {
                reqs = new Set()
                requires.set(course.code, reqs)
            }
            reqs.add(pre.code)
        }
    }

    return { dependents, requires, byCode }
}

/**
 * `code` dersinden kalinirsa kilitlenen TUM derslerin kodlari (gecisli kapanis).
 *
 * Dersin kendisi sonuca dahil degildir. Katalogda dongu olusursa (A, B'nin
 * onkosulu ve B de A'nin) ziyaret edilmis kumesi sonsuz dongusunu engeller.
 */
export function cascade(graph: PrereqGraph, code: string): string[] {
    const seen = new Set<string>()
    const stack = [code]

    while (stack.length) {
        const current = stack.pop() as string
        for (const dep of graph.dependents.get(current) ?? []) {
            if (seen.has(dep)) continue
            seen.add(dep)
            stack.push(dep)
        }
    }

    seen.delete(code)
    return [...seen]
}

/**
 * Zincirin kac kademe derine indigi. Onkosul zinciri yoksa 0.
 *
 * Statik -> Mukavemet I -> Yapi Statigi I -> Yapi Statigi II -> Yapi Dinamigi
 * icin 4 doner.
 */
export function depth(graph: PrereqGraph, code: string): number {
    const visiting = new Set<string>()

    const walk = (current: string): number => {
        visiting.add(current)

        let best = 0
        for (const dep of graph.dependents.get(current) ?? []) {
            // Dongu korumasi: zincire geri donen kenar bir kademe SAYILMAZ,
            // yoksa A<->B ikilisi 1 yerine 2 derinlik verir.
            if (visiting.has(dep)) continue
            best = Math.max(best, 1 + walk(dep))
        }

        visiting.delete(current)
        return best
    }

    return walk(code)
}

// --------------------------------------------------------------------------
// Gorsel zincir
// --------------------------------------------------------------------------

export interface ChainNode {
    code: string
    name: string
    term: number | null
    /** Bu dersin dogrudan onkosullari (yalnizca grafikteki kodlar). */
    requires: string[]
}

/**
 * Onkosul zincirini kademelere ayirir: 0. kademede hicbir onkosulu olmayan
 * (ama bir seye onkosul olan) dersler, n. kademede onkosullari daha alt
 * kademelerde biten dersler.
 *
 * Yalnizca zincire katilan dersler doner; programin geri kalani disarida
 * kalir. Dongu varsa (katalogda olmamali) zincire giremeyen dersler en son
 * kademeye konur, boylece hicbir ders kaybolmaz.
 */
export function chainLevels(graph: PrereqGraph): ChainNode[][] {
    const participating = new Set<string>([
        ...graph.requires.keys(),
        ...graph.dependents.keys(),
    ])

    const levelOf = new Map<string, number>()
    let changed = true
    // Kademe sayisi en fazla dugum sayisi kadar olabilir; dongude bu sinir
    // dongunun sonsuza gitmesini engeller.
    let guard = participating.size + 1

    while (changed && guard-- > 0) {
        changed = false
        for (const code of participating) {
            const reqs = [...(graph.requires.get(code) ?? [])].filter((r) =>
                participating.has(r),
            )
            const resolved = reqs.map((r) => levelOf.get(r))
            const next = resolved.some((v) => v === undefined)
                ? undefined
                : Math.max(-1, ...(resolved as number[])) + 1

            if (next !== undefined && levelOf.get(code) !== next) {
                levelOf.set(code, next)
                changed = true
            }
        }
    }

    const unresolved = [...participating].filter((c) => !levelOf.has(c))
    const maxLevel = Math.max(-1, ...levelOf.values())
    for (const code of unresolved) levelOf.set(code, maxLevel + 1)

    const out: ChainNode[][] = []
    for (const code of participating) {
        const level = levelOf.get(code) as number
        while (out.length <= level) out.push([])
        out[level].push({
            code,
            name: graph.byCode.get(code)?.name ?? code,
            term: graph.byCode.get(code)?.term ?? null,
            requires: [...(graph.requires.get(code) ?? [])],
        })
    }

    for (const level of out) {
        level.sort((a, b) => (a.term ?? 99) - (b.term ?? 99) || a.code.localeCompare(b.code))
    }
    return out
}

// --------------------------------------------------------------------------
// Etki ozeti ("bu dersten kalirsam ne olur")
// --------------------------------------------------------------------------

export interface ImpactedCourse {
    code: string
    name: string
    /** Katalogdaki yariyil; bilinmiyorsa null. */
    term: number | null
}

export interface Impact {
    code: string
    name: string
    /** Kilitlenen dersler, yariyila gore sirali. */
    locked: ImpactedCourse[]
    /** Zincirin derinligi. */
    depth: number
    /** Kilitlenen derslerin en gec yariyili; hicbiri yoksa null. */
    lastTerm: number | null
}

/**
 * `code` dersinden kalmanin sonucu. Grafik zaten kurulmus olmali.
 */
export function impactOf(graph: PrereqGraph, code: string): Impact {
    const locked: ImpactedCourse[] = []

    for (const dep of cascade(graph, code)) {
        const course = graph.byCode.get(dep)
        locked.push({
            code: dep,
            name: course?.name ?? dep,
            term: course?.term ?? null,
        })
    }

    locked.sort((a, b) => {
        // Yariyili bilinmeyenler sona.
        if (a.term === null) return b.term === null ? a.code.localeCompare(b.code) : 1
        if (b.term === null) return -1
        return a.term - b.term || a.code.localeCompare(b.code)
    })

    const terms = locked
        .map((c) => c.term)
        .filter((t): t is number => t !== null)

    return {
        code,
        name: graph.byCode.get(code)?.name ?? code,
        locked,
        depth: depth(graph, code),
        lastTerm: terms.length ? Math.max(...terms) : null,
    }
}
