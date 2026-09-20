/**
 * Muhendislik Fakultesi ogretim plani arsivini ice alir.
 *
 * Neden: katalogda (debis) yalnizca guncel yil var, ama planlar degisiyor.
 * Insaat'ta 2024'te toplu yeniden numaralandirma olmus: AKISKANLAR MEKANIGI
 * INS 2014 iken INS 2114 olmus, YAPI DINAMIGI INS 4009 iken INS 4109.
 * 2021 girisli bir ogrencinin transkriptinde eski kodlar yazar.
 *
 * Kaynak: eng.deu.edu.tr. robots.txt'i yalnizca /wp-includes/ kapatiyor,
 * plan PDF'leri serbest. debis'in yasakli yillarina DOKUNULMAZ.
 *
 * Kapsam: yalnizca Muhendislik Fakultesi. Diger fakulteler ya arsiv
 * yayinlamiyor (Isletme, IIBF) ya da robots.txt ile kapatmis (Guzel
 * Sanatlar: /wp-content/, /archives/).
 *
 * Calistirma: npm run archive
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph } from '../src/lib/prereq'
import type { Course, DataIndex, ProgramChain, ProgramPlans, PlanVersion } from '../src/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'public', 'data')
const CACHE = join(ROOT, 'tools', '.cache', 'plans')

const PAGES = [
    'https://eng.deu.edu.tr/tr/ogretim-planlari-arsivi/',
    'https://eng.deu.edu.tr/tr/ogretim-planlari/',
]

const UA = 'Mozilla/5.0 (compatible; deu-onkosul/0.1; +https://dokuzeylul.net)'

const CODE = /[A-ZÇĞİÖŞÜ]{2,5}\s?\d{3,4}/g

// --------------------------------------------------------------------------
// Indirme
// --------------------------------------------------------------------------

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
    return res.text()
}

/** PDF'i diske indirir ve duz metne cevirir. Ikisi de cache'lenir. */
async function planText(url: string): Promise<string | null> {
    const name = url.replace(/[^a-zA-Z0-9]+/g, '_')
    const pdf = join(CACHE, `${name}.pdf`)
    const txt = join(CACHE, `${name}.txt`)
    if (existsSync(txt)) return readFileSync(txt, 'utf-8')

    mkdirSync(CACHE, { recursive: true })
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null

    const buf = Buffer.from(await res.arrayBuffer())
    // Kirik linkler PDF yerine 404 HTML'i donuyor; pdftotext'e vermeden ele.
    if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) return null
    writeFileSync(pdf, buf)

    try {
        execFileSync('pdftotext', ['-layout', pdf, txt], { stdio: 'ignore' })
    } catch {
        return null
    }
    return existsSync(txt) ? readFileSync(txt, 'utf-8') : null
}

// --------------------------------------------------------------------------
// Ayristirma
// --------------------------------------------------------------------------

/**
 * Basliktan bolum adi ve ogretim yili.
 *
 * Iki bicim var:
 *   "Muhendislik Fakultesi - Insaat Muhendisligi 2024-2025 Ogretim Plani"
 *   "Muhendislik Fakultesi - Insaat Muhendisligi Ogretim Plani" + "(2012-2013 Ogretim Yili)"
 */
function parseHeader(text: string, url: string): { program: string; year: number } | null {
    const head = text.split('\n').slice(0, 8).join('\n')

    const line = /Fakültesi\s*[-–]\s*(.+?)\s*(?:(\d{4})\s*[-–]\s*\d{4}\s*)?Öğretim\s*Plan/i.exec(head)
    if (!line) return null

    const program = line[1].replace(/\s+/g, ' ').trim()
    const inline = line[2]
    const separate = /\(\s*(\d{4})\s*[-–]\s*\d{4}\s*Öğretim\s*Yılı\s*\)/i.exec(head)

    // Bazi PDF'lerin basliginda yil yok, yalnizca basim tarihi var
    // (orn. ogr_plan_INS_2016_2019.pdf). Yil dosya adindan okunur; bu
    // olmadan o surum tamamen kaybolur ve bir onceki surumun gecerlilik
    // araligi yanlis sekilde uzar.
    const fromName = /(?:^|[^0-9])(20\d{2})[_-](?:20)?\d{2}(?:[^0-9]|$)/.exec(
        url.split('/').pop() ?? '',
    )
    const year = Number(inline ?? separate?.[1] ?? fromName?.[1])

    return Number.isFinite(year) ? { program, year } : null
}

/** Baslik satirindan (onSart, kod, blokSonu) uclulerini cikarir. */
function columns(header: string): [number, number, number][] {
    const starts = [...header.matchAll(/Ön\s*Şart/g)].map((m) => m.index as number)
    const codes = [...header.matchAll(/\bKod\b/g)].map((m) => m.index as number)
    const out: [number, number, number][] = []
    for (let i = 0; i < starts.length; i += 1) {
        const k = codes.find((c) => c > starts[i])
        if (k === undefined) continue
        out.push([starts[i], k, starts[i + 1] ?? header.length + 400])
    }
    return out
}

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** "UCUNCU YARIYIL" -> 3. Plan PDF'leri yariyili yaziyla yaziyor. */
const ORDINALS: Record<string, number> = {
    'BİRİNCİ': 1, 'İKİNCİ': 2, 'ÜÇÜNCÜ': 3, 'DÖRDÜNCÜ': 4,
    'BEŞİNCİ': 5, 'ALTINCI': 6, 'YEDİNCİ': 7, 'SEKİZİNCİ': 8,
}

/**
 * Yariyil basligi satirindan (konum, yariyil) ciftlerini cikarir.
 *
 * Tablo basliginin hemen ustunde durur ve iki sutunlu yerlesimde iki
 * yariyili yan yana yazar:
 *   "        UCUNCU YARIYIL                        DORDUNCU YARIYIL"
 */
function termHeader(line: string): [number, number][] {
    const out: [number, number][] = []
    for (const m of line.matchAll(/([A-ZÇĞİÖŞÜ]+)\s+YARIYIL/g)) {
        const n = ORDINALS[m[1]]
        if (n) out.push([m.index as number, n])
    }
    return out
}

/**
 * Ders tablosunu sutun konumundan okur.
 *
 * Kod eslestirmesi yapmaz: "satirdaki ilk iki kod" yaklasimi secmeli ders
 * tablolarinda yanlis eslestiriyor. Basliktaki "Kod" sutununun konumu esas
 * alinir. Plan PDF'leri 2016'dan beri iki yariyili yan yana basiyor, bu
 * yuzden satir basina birden fazla blok olabilir.
 */
function parsePlan(
    text: string,
): Map<
    string,
    { name: string; prereqs: Set<string>; term: number | null; elective: boolean }
> {
    const out = new Map<
        string,
        { name: string; prereqs: Set<string>; term: number | null; elective: boolean }
    >()
    let blocks: [number, number, number][] | null = null
    let terms: [number, number][] = []
    let blockTerms: (number | null)[] = []
    // Plan PDF'i her yariyilin altinda "Secmeli Dersler" basligiyla ikinci bir
    // tablo aciyor. Bu basliktan sonraki dersler secmeli sayilir; yeni bir
    // yariyil basligi gelince zorunluya doner.
    let elective = false

    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '')

        const th = termHeader(line)
        if (th.length) { terms = th; elective = false; continue }
        if (/Se[çc]meli\s+Dersler/i.test(line)) { elective = true; continue }

        if (line.includes('Ön Şart') && /\bKod\b/.test(line)) {
            blocks = columns(line)
            // Her sutun blogunu, konumca en yakin yariyil basligiyla esle.
            blockTerms = blocks.map(([start]) => {
                let best: number | null = null
                let bestDist = Infinity
                for (const [pos, n] of terms) {
                    const d = Math.abs(pos - start)
                    if (d < bestDist) { bestDist = d; best = n }
                }
                // Cok uzaksa (orn. secmeli ders tablosu) yariyil atanmaz.
                return bestDist <= 220 ? best : null
            })
            // Baslik tuketildi; bir sonraki tablo kendi basligini bekler.
            terms = []
            continue
        }
        if (!blocks) continue

        for (let bi = 0; bi < blocks.length; bi += 1) {
            const [start, kod, end] = blocks[bi]
            const right = line.slice(kod, end)
            const m = CODE.exec(right)
            CODE.lastIndex = 0
            if (!m || (m.index ?? 0) > 3) continue

            const code = clean(m[0])
            const name = clean(right.slice((m.index ?? 0) + m[0].length).replace(/\s+\d+\s+\d+\s+\d+.*$/, ''))

            // Sol sutunu birkac karakter genis al: kodun bas harfi ("İ")
            // sutun sinirinda kesilebiliyor.
            const left = line.slice(Math.max(0, start - 4), kod)
            const prereqs = [...left.matchAll(CODE)].map((x) => clean(x[0]))

            const entry = out.get(code)
                ?? { name, prereqs: new Set<string>(), term: blockTerms[bi] ?? null, elective }
            if (!entry.name && name) entry.name = name
            if (entry.term === null) entry.term = blockTerms[bi] ?? null
            for (const p of prereqs) entry.prereqs.add(p)
            out.set(code, entry)
        }
    }
    return out
}

// --------------------------------------------------------------------------
// Ana akis
// --------------------------------------------------------------------------

const norm = (s: string): string =>
    s.toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '')

/**
 * Katalogun kapsadigi ilk yil. Bu yildan itibaren katalog esastir; PDF
 * surumleri yalnizca daha eski yillar icin tutulur.
 *
 * Neden: katalog coklu onkosulu tasiyabiliyor, PDF'in dar "On Sart" sutunu
 * tasiyamiyor. Ornek: JEF 3202 BOLUM ARAZI STAJI'nin katalogda dort onkosulu
 * var, 2024-25 PDF'inde ayni satirda "-" yaziyor. Ayni yil icin PDF'i
 * yayinlamak veriyi fakirlestirmek olur.
 */
const CATALOG_FROM = 2024

async function main(): Promise<number> {
    try {
        execFileSync('pdftotext', ['-v'], { stdio: 'ignore' })
    } catch {
        console.error('pdftotext bulunamadi. macOS: brew install poppler')
        return 1
    }

    const index: DataIndex = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf-8'))
    const eng = index.programs.filter(
        (p) => p.faculty === 'Mühendislik Fakültesi' && p.level === 'lisans',
    )
    const byName = new Map(eng.map((p) => [norm(p.name), p]))

    // 1) Plan PDF adreslerini topla
    const urls = new Set<string>()
    for (const page of PAGES) {
        const html = await fetchText(page)
        for (const m of html.matchAll(/href="(https?:\/\/eng\.deu\.edu\.tr\/[^"]+\.pdf)"/g)) {
            urls.add(m[1])
        }
    }
    console.log(`Aday PDF: ${urls.size}`)

    // 2) Indir, ayristir, programa esle
    type Parsed = { year: number; url: string; courses: Course[] }
    const perProgram = new Map<string, Parsed[]>()
    let skipped = 0
    let unmatched = new Set<string>()

    for (const url of [...urls].sort()) {
        const text = await planText(url)
        if (!text) { skipped += 1; continue }

        const head = parseHeader(text, url)
        if (!head) { skipped += 1; continue }

        // Katalog adi PDF adindan daha uzun olabiliyor ("Bilgisayar
        // Muhendisligi" -> "Bilgisayar Muhendisligi (Ingilizce)").
        const key = norm(head.program)
        const meta =
            byName.get(key) ??
            eng.find((p) => norm(p.name).startsWith(key) && !norm(p.name).includes('io'))
        if (!meta) { unmatched.add(head.program); continue }

        const table = parsePlan(text)
        if (table.size === 0) { skipped += 1; continue }

        const courses: Course[] = [...table].map(([code, v]) => ({
            code,
            name: v.name || code,
            term: v.term,
            type: v.elective ? ('SECMELI' as const) : ('ZORUNLU' as const),
            prerequisites: [...v.prereqs].map((c) => ({ code: c, name: table.get(c)?.name ?? c })),
        }))

        const list = perProgram.get(meta.id) ?? []
        list.push({ year: head.year, url, courses })
        perProgram.set(meta.id, list)
    }

    // 3) Capraz dogrulama.
    //
    //    Yalnizca katalogla AYNI DONEME ait PDF'ler (>= CATALOG_FROM)
    //    karsilastirilir; 2023 plani ile 2025-2026 katalogunu karsilastirmak
    //    zaten farkli iki plani karsilastirmak olur.
    //
    //    Kural: PDF, katalogda OLMAYAN bir onkosul iddia edemez ("fazla" == 0).
    //    Bu, ayristiricinin sahte kenar uretmesini yakalar. Tersi ("eksik")
    //    hata sayilmaz, cunku PDF'in dar sutunu coklu onkosulu basamiyor.
    const problems: string[] = []
    let checked = 0
    for (const [id, versions] of perProgram) {
        const chainFile = join(DATA, 'programs', `${id}.json`)
        if (!existsSync(chainFile)) continue

        const newest = versions.reduce((a, b) => (b.year > a.year ? b : a))
        if (newest.year < CATALOG_FROM) continue
        checked += 1

        const current: ProgramChain = JSON.parse(readFileSync(chainFile, 'utf-8'))
        const expected = new Set(
            current.courses.filter((c) => c.prerequisites.some((p) => p.code)).map((c) => c.code),
        )
        const got = new Set(
            newest.courses.filter((c) => c.prerequisites.length).map((c) => c.code),
        )

        const extra = [...got].filter((c) => !expected.has(c))
        if (extra.length) {
            problems.push(
                `${id} ${current.name} (${newest.year}): katalogda olmayan `
                + `${extra.length} onkosul [${extra.slice(0, 5).join(', ')}]`,
            )
        }
    }

    // 4) Ayni icerikli ardisik surumleri birlestir ve yaz
    rmSync(join(DATA, 'plans'), { recursive: true, force: true })
    mkdirSync(join(DATA, 'plans'), { recursive: true })

    const fingerprint = (courses: Course[]): string =>
        courses
            .map((c) => `${c.code}<${c.prerequisites.map((p) => p.code).sort().join('|')}`)
            .sort()
            .join(';')

    let written = 0
    let totalVersions = 0
    for (const [id, versions] of perProgram) {
        // CATALOG_FROM ve sonrasi katalogdan gelir; PDF surumu yayinlamak
        // veriyi fakirlestirir.
        versions.sort((a, b) => a.year - b.year)
        const historical = versions.filter((v) => v.year < CATALOG_FROM)
        if (historical.length === 0) continue

        const merged: PlanVersion[] = []
        for (const v of historical) {
            const fp = fingerprint(v.courses)
            const last = merged[merged.length - 1]
            if (last && last.fingerprint === fp) {
                // Ayni plan, yalnizca yeniden basilmis; araligi uzat.
                continue
            }
            merged.push({
                validFrom: v.year,
                validTo: null,
                label: `${v.year}-${v.year + 1}`,
                fingerprint: fp,
                source: v.url,
                courses: v.courses,
            })
        }
        for (let i = 0; i < merged.length - 1; i += 1) {
            merged[i].validTo = merged[i + 1].validFrom - 1
        }
        // Son tarihsel surum, katalogun devraldigi yila kadar gecerli.
        merged[merged.length - 1].validTo = CATALOG_FROM - 1

        const meta = eng.find((p) => p.id === id)
        const payload: ProgramPlans = {
            id,
            name: meta?.name ?? id,
            versions: merged,
        }
        writeFileSync(join(DATA, 'plans', `${id}.json`), JSON.stringify(payload), 'utf-8')
        written += 1
        totalVersions += merged.length
    }

    console.log(`Program        : ${written}`)
    console.log(`Capraz kontrol : ${checked} program (katalogla ayni donem)`)
    console.log(`Plan surumu    : ${totalVersions} (ayni olanlar birlestirildi)`)
    console.log(`Atlanan PDF    : ${skipped} (kirik link / plan degil)`)
    if (unmatched.size) {
        console.log(`Eslesmeyen bolum: ${[...unmatched].join(', ')}`)
    }

    if (problems.length) {
        console.error('\nCAPRAZ DOGRULAMA BASARISIZ (PDF ayristirici katalogla uyusmuyor):')
        for (const p of problems) console.error(`  ${p}`)
        return 1
    }
    console.log('\nCapraz dogrulama: en yeni plan PDF\'leri katalogla birebir ayni.')
    return 0
}

main().then((code) => process.exit(code))
