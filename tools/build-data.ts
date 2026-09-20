/**
 * Ince veri uretici.
 *
 * Kaynak: dokuzeylul-analyzer'in kazidigi tam katalog (647 program, 41.130
 * ders, ~14 MB). Bu uygulama transkript islemedigi icin o verinin tamamina
 * ihtiyaci yok; yalnizca ON KOSUL ZINCIRINE KATILAN dersler tasinir.
 *
 * Kazima tek yerde kalir (analyzer'daki tools/scraper/scrape.py). Burada
 * uretilen public/data commit edilir, boylece bu uygulama calisma aninda
 * analyzer'a bagimli olmaz; yalnizca veriyi yenilerken kaynak gerekir.
 *
 * Calistirma:
 *   npm run data
 *   DEU_CATALOG_DIR=/baska/yol npm run data
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph, cascade } from '../src/lib/prereq'
import type { Course, DataIndex, ProgramChain, ProgramMeta } from '../src/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(
    process.env.DEU_CATALOG_DIR ??
    join(ROOT, '..', 'dokuzeylulanalyzer', 'public', 'data'),
)
const OUT = join(ROOT, 'public', 'data')

/** Analyzer'in program JSON'undan ihtiyacimiz olan alanlar. */
interface SourceProgram {
    id: string
    name: string
    faculty: string
    level: string
    levelLabel: string
    catalogYear: string
    courses: {
        code: string
        name: string
        term: number | null
        prerequisites?: { code: string; name: string }[]
        /** Katalogdaki ders sayfasi, yil koku olmadan. */
        detail?: string
        /** "ZORUNLU", "TEKNIK SECMELI", "STAJ"... */
        rawType?: string
    }[]
}

function main(): number {
    let files: string[]
    try {
        files = readdirSync(join(SOURCE, 'programs')).filter((f) => f.endsWith('.json'))
    } catch {
        console.error(`Kaynak katalog bulunamadi: ${SOURCE}`)
        console.error('dokuzeylul-analyzer deposunu yanina klonlayin ya da')
        console.error('DEU_CATALOG_DIR ile yolu verin.')
        return 1
    }

    const sourceIndex = JSON.parse(
        readFileSync(join(SOURCE, 'index.json'), 'utf-8'),
    ) as { catalogYear: string; source: string }

    // "https://debis.deu.edu.tr/ders-katalog/2025-2026/tr/"
    const catalogBase = sourceIndex.source.endsWith('/')
        ? sourceIndex.source
        : `${sourceIndex.source}/`

    // Her kosuda sifirdan uret; kaynaktan kalkan program artik yayinlanmasin.
    rmSync(join(OUT, 'programs'), { recursive: true, force: true })
    mkdirSync(join(OUT, 'programs'), { recursive: true })

    const metas: ProgramMeta[] = []
    let missingField = 0
    let totalPrereq = 0

    for (const file of files) {
        const src = JSON.parse(
            readFileSync(join(SOURCE, 'programs', file), 'utf-8'),
        ) as SourceProgram

        if (!src.courses.some((c) => 'prerequisites' in c)) {
            // Kaynak bu program icin onkosul gecisinden gecmemis. Sessizce
            // "onkosulu yok" diye yayinlamak yanlis olur; sayilir ve raporlanir.
            missingField += 1
            continue
        }

        const courses: Course[] = src.courses.map((c) => ({
            code: c.code,
            name: c.name,
            term: c.term,
            prerequisites: c.prerequisites ?? [],
            // Staj zorunlu bir yukumluluk; secmeli havuzu degil.
            type: c.rawType === 'ZORUNLU' || c.rawType === 'STAJ' ? 'ZORUNLU' : 'SECMELI',
            // Kanit baglantisi: iddia bizim degil, katalogun.
            ...(c.detail ? { source: catalogBase + c.detail } : {}),
        }))

        const graph = buildGraph(courses)
        const participating = new Set<string>([
            ...graph.requires.keys(),
            ...graph.dependents.keys(),
        ])

        // Kodu olan on kosul zinciri kurar. Kodu olmayan ("HAZIRLIK SINIFI"
        // gibi serbest metin) gercek bir sarttir ama zincire baglanamaz;
        // ayri sayilir, yoksa "en fazla 0 ders kilitlenir" gibi anlamsiz bir
        // rozet cikiyor.
        const hasCoded = (c: Course) => c.prerequisites.some((p) => p.code)
        const onlyNote = (c: Course) =>
            c.prerequisites.length > 0 && !hasCoded(c)

        const prereqCount = courses.filter(hasCoded).length
        const noteCount = courses.filter(onlyNote).length
        const maxLocked = Math.max(
            0,
            ...[...graph.dependents.keys()].map((code) => cascade(graph, code).length),
        )
        totalPrereq += prereqCount

        metas.push({
            id: src.id,
            name: src.name,
            faculty: src.faculty,
            level: src.level,
            levelLabel: src.levelLabel,
            prereqCount,
            noteCount,
            maxLocked,
        })

        if (prereqCount === 0 && noteCount === 0) continue

        // Ayni kod birden fazla satirda olabilir (secmeli havuzlari); zincirde
        // her ders bir kez temsil edilir.
        const seen = new Set<string>()
        const slim = courses.filter((c) => {
            if (!participating.has(c.code) && !onlyNote(c)) return false
            if (seen.has(c.code)) return false
            seen.add(c.code)
            return true
        })

        const chain: ProgramChain = {
            id: src.id,
            name: src.name,
            faculty: src.faculty,
            levelLabel: src.levelLabel,
            catalogYear: src.catalogYear,
            source: `${catalogBase}bolum_${src.id}_tr.html`,
            courses: slim,
        }
        writeFileSync(
            join(OUT, 'programs', `${src.id}.json`),
            JSON.stringify(chain),
            'utf-8',
        )
    }

    metas.sort((a, b) => b.maxLocked - a.maxLocked || a.name.localeCompare(b.name, 'tr'))

    const index: DataIndex = {
        catalogYear: sourceIndex.catalogYear,
        source: sourceIndex.source,
        generatedAt: new Date().toISOString(),
        programs: metas,
    }
    writeFileSync(join(OUT, 'index.json'), JSON.stringify(index), 'utf-8')

    const withChain = metas.filter((m) => m.prereqCount > 0).length
    const withNote = metas.filter((m) => m.prereqCount === 0 && m.noteCount > 0).length
    console.log(`Kaynak            : ${SOURCE}`)
    console.log(`Program           : ${metas.length}`)
    console.log(`Zincirli program  : ${withChain}`)
    console.log(`Zincirli ders     : ${totalPrereq}`)
    console.log(`Yalniz metin sart : ${withNote} program (orn. "HAZIRLIK SINIFI")`)
    if (missingField) {
        console.log(`ATLANDI           : ${missingField} program (kaynakta onkosul alani yok)`)
    }
    if (withChain === 0) {
        console.error('HATA: hicbir programda onkosul bulunamadi, kaynak veri supheli.')
        return 1
    }
    return 0
}

process.exit(main())
