/**
 * Her bolum icin statik HTML uretir: dist/program/<id>/index.html
 *
 * Uygulama bir Vite SPA, uretilen index.html'in govdesi bos. Google
 * "deu insaat on kosul" aramasinda bu sayfalari bulamaz. Burada uretilen
 * dosyalar #root icine zinciri duz metin olarak koyar; JavaScript calisinca
 * React ayni yere interaktif surumu basar.
 *
 * Calistirma: npm run build zincirinde, ya da npm run prerender
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph, cascade, chainLevels, depth, impactOf } from '../src/lib/prereq'
import type { DataIndex, ProgramChain } from '../src/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Sitenin canli adresi. canonical, og:url ve sitemap mutlak adres ister;
 * yanlis alan adi canonical'i zararli hale getirir, bu yuzden deploy ettigin
 * adrese gore SITE_URL ile ezilmeli.
 */
const SITE = (process.env.SITE_URL ?? 'https://deu-onkosul.pages.dev').replace(/\/+$/, '')
const DIST = join(ROOT, 'dist')
const DATA = join(ROOT, 'public', 'data')

const esc = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

/**
 * Sablonun <title>, description ve #root icerigini degistirir. Tek kaynak
 * sablon (dist/index.html) kullanildigi icin Vite'in hash'li asset yollari
 * kendiliginden dogru kalir.
 */
function render(
    template: string,
    opts: {
        title: string
        description: string
        body: string
        /** Sitedeki yol, "/program/1198" gibi. canonical ve og:url icin. */
        path: string
        noindex?: boolean
        /** Sayfaya gomulecek JSON-LD; arama sonucunda zengin gosterim icin. */
        jsonLd?: object
    },
): string {
    const url = `${SITE}${opts.path}`
    const head = [
        opts.noindex ? '<meta name="robots" content="noindex,follow" />' : '',
        `<link rel="canonical" href="${esc(url)}" />`,
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="DEU On Kosul" />',
        '<meta property="og:locale" content="tr_TR" />',
        `<meta property="og:url" content="${esc(url)}" />`,
        `<meta property="og:title" content="${esc(opts.title)}" />`,
        `<meta property="og:description" content="${esc(opts.description)}" />`,
        '<meta name="twitter:card" content="summary" />',
        `<meta name="twitter:title" content="${esc(opts.title)}" />`,
        `<meta name="twitter:description" content="${esc(opts.description)}" />`,
        opts.jsonLd
            ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`
            : '',
        `<title>${esc(opts.title)}</title>`,
    ].filter(Boolean).join('\n  ')

    return template
        .replace(/<title>.*?<\/title>/s, head)
        .replace(
            /<meta name="description"[\s\S]*?\/>/,
            `<meta name="description" content="${esc(opts.description)}" />`,
        )
        .replace('<div id="root"></div>', `<div id="root">${opts.body}</div>`)
}

/** Ders kodunu adres parcasina cevirir; src/lib/slug.ts ile ayni kural. */
const TR: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', I: 'i', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
}
const slugify = (code: string): string =>
    code.split('').map((ch) => TR[ch] ?? ch).join('')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * "X dersinden kalirsan ne olur" sonuc sayfasinin govdesi.
 *
 * Aranan uzun kuyruk sorgusunun tam karsiligi; bu yuzden SEO icin
 * indekslenecek asil sayfalar bunlar.
 */
function resultBody(program: ProgramChain, code: string): string {
    const graph = buildGraph(program.courses)
    const impact = impactOf(graph, code)
    const out = [
        `<h1>${esc(impact.code)} ${esc(impact.name)} dersinden kalirsan `
        + `${impact.locked.length} ders kilitlenir</h1>`,
        `<p>${esc(program.name)} &middot; ${esc(program.faculty)} &middot; `
        + `DEU Ders Katalogu ${esc(program.catalogYear)}</p>`,
        `<p>Zincir ${impact.depth} kademe`
        + (impact.lastTerm !== null ? `, en gec ${impact.lastTerm}. yariyila kadar` : '')
        + '.</p>',
        '<h2>Kilitlenen dersler</h2>',
        '<ul>',
        ...impact.locked.map(
            (c) =>
                `<li>${esc(c.code)} ${esc(c.name)}`
                + (c.term !== null ? ` (${c.term}. yariyil)` : '')
                + '</li>',
        ),
        '</ul>',
        `<p><a href="/program/${program.id}">${esc(program.name)} on kosul zincirinin `
        + 'tamami</a></p>',
    ]
    return out.join('\n')
}

/** Sonuc sayfasi icin soru-cevap yapisal verisi. */
function faqJsonLd(program: ProgramChain, code: string): object {
    const graph = buildGraph(program.courses)
    const impact = impactOf(graph, code)
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [{
            '@type': 'Question',
            name: `${program.name} bolumunde ${code} ${impact.name} dersinden kalirsam ne olur?`,
            acceptedAnswer: {
                '@type': 'Answer',
                text:
                    `${impact.locked.length} ders kilitlenir: `
                    + impact.locked.map((c) => `${c.code} ${c.name}`).join(', ')
                    + `. Zincir ${impact.depth} kademe`
                    + (impact.lastTerm !== null ? `, en gec ${impact.lastTerm}. yariyila kadar` : '')
                    + '.',
            },
        }],
    }
}

const NO_PREREQ_NOTE =
    'DEU Ders Katalogu bu bolumun hicbir dersinde on kosul tanimlamamis. Bu, '
    + 'fakultenin kendi ogretim ve sinav uygulama esaslarinda bir kosul olmadigi '
    + 'anlamina gelmez; emin olmak icin danismaniniza sorun.'

function programBody(program: ProgramChain): string {
    const graph = buildGraph(program.courses)
    const risky = [...graph.dependents.keys()]
        .map((code) => ({
            code,
            name: graph.byCode.get(code)?.name ?? code,
            term: graph.byCode.get(code)?.term ?? null,
            locked: cascade(graph, code).length,
            depth: depth(graph, code),
        }))
        .sort((a, b) => b.locked - a.locked || a.code.localeCompare(b.code))

    const out = [
        `<h1>${esc(program.name)} on kosullu dersler</h1>`,
        `<p>${esc(program.faculty)} &middot; ${esc(program.levelLabel)} &middot; `
        + `DEU Ders Katalogu ${esc(program.catalogYear)}</p>`,
    ]

    // On kosulu ders degil de serbest metin olan dersler (orn. hazirlik sinifi).
    const notes = program.courses.filter(
        (c) => c.prerequisites.length > 0 && !c.prerequisites.some((p) => p.code),
    )
    if (notes.length) {
        out.push(
            `<h2>Ders disi sart: ${esc(notes[0].prerequisites[0].name)}</h2>`,
            '<p>Su derslerin on kosulu bir ders degil, katalogda serbest metin olarak '
            + 'yazilmis. Zincire giremez ama gercek bir sarttir.</p>',
            '<ul>',
            ...notes.map((c) => `<li>${esc(c.code)} ${esc(c.name)}</li>`),
            '</ul>',
        )
    }

    if (risky.length === 0) {
        if (!notes.length) out.push(`<p>${NO_PREREQ_NOTE}</p>`)
        return out.join('\n')
    }

    out.push(
        `<p>${esc(risky[0].code)} ${esc(risky[0].name)} dersinden kalmak `
        + `${risky[0].locked} dersi kilitler.</p>`,
        '<h2>Kalinca en cok ders kilitleyenler</h2>',
        '<ul>',
        ...risky.map(
            (r) =>
                `<li>${esc(r.code)} ${esc(r.name)}`
                + (r.term !== null ? ` (${r.term}. yariyil)` : '')
                + ` &ndash; ${r.locked} ders kilitler, zincir derinligi ${r.depth}</li>`,
        ),
        '</ul>',
        '<h2>On kosul zinciri</h2>',
    )

    chainLevels(graph).forEach((level, i) => {
        out.push(`<h3>${i + 1}. kademe</h3>`, '<ul>')
        for (const node of level) {
            out.push(
                `<li>${esc(node.code)} ${esc(node.name)}`
                + (node.term !== null ? ` (${node.term}. yariyil)` : '')
                + (node.requires.length
                    ? ` &ndash; on kosul: ${esc(node.requires.join(', '))}`
                    : '')
                + '</li>',
            )
        }
        out.push('</ul>')
    })

    return out.join('\n')
}

function main(): number {
    let template: string
    try {
        template = readFileSync(join(DIST, 'index.html'), 'utf-8')
    } catch {
        console.error('dist/index.html yok. Once "vite build" calistirin.')
        return 1
    }

    const index: DataIndex = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf-8'))

    let written = 0
    let withChain = 0
    let withNote = 0
    let results = 0
    const links: string[] = []
    // sitemap'e yalnizca INDEKSLENEBILIR sayfalar girer; noindex isaretli
    // ara adimlari listelemek Google'a celiskili sinyal verir.
    const sitemap: string[] = ['/']

    for (const meta of index.programs) {
        const file = join(DATA, 'programs', `${meta.id}.json`)
        // On kosulu olmayan bolumlerin zincir dosyasi uretilmez; sayfasi yine
        // yazilir ki "katalogda tanimli yok" cevabi arama sonucundan gorulsun.
        const program: ProgramChain = existsSync(file)
            ? JSON.parse(readFileSync(file, 'utf-8'))
            : {
                id: meta.id,
                name: meta.name,
                faculty: meta.faculty,
                levelLabel: meta.levelLabel,
                catalogYear: index.catalogYear,
                courses: [],
            }
        if (meta.prereqCount > 0) withChain += 1
        else if (meta.noteCount > 0) withNote += 1

        const dir = join(DIST, 'program', meta.id)
        mkdirSync(dir, { recursive: true })
        writeFileSync(
            join(dir, 'index.html'),
            render(template, {
                path: `/program/${meta.id}`,
                title: `${program.name} on kosullu dersler | DEU On Kosul`,
                description:
                    `${program.name} (${program.faculty}) on kosullu dersleri ve hangi `
                    + 'dersten kalinca hangi derslerin kilitlendigi. DEU Ders Katalogu '
                    + `${index.catalogYear}.`,
                body: programBody(program),
            }),
            'utf-8',
        )
        written += 1
        sitemap.push(`/program/${meta.id}`)

        // Sihirbazin ara adimlari (yil ve ders secimi) icerik tasimaz;
        // indekslenirlerse 647 x yil x ders kadar degersiz sayfa cikar.
        for (const path of [
            join(DIST, 'program', meta.id, 'yil'),
            join(DIST, 'program', meta.id, 'yil', 'guncel', 'ders'),
        ]) {
            mkdirSync(path, { recursive: true })
            writeFileSync(
                join(path, 'index.html'),
                render(template, {
                    path: path.replace(DIST, ''),
                    title: `${program.name} | DEU On Kosul`,
                    description: `${program.name} on kosul sihirbazi.`,
                    body: `<h1>${esc(program.name)}</h1>`,
                    noindex: true,
                }),
                'utf-8',
            )
        }

        // Sonuc sayfalari: her on kosullu ders icin bir tane.
        const graph = buildGraph(program.courses)
        for (const code of graph.dependents.keys()) {
            const dir = join(DIST, 'program', meta.id, 'yil', 'guncel', 'ders', slugify(code))
            mkdirSync(dir, { recursive: true })
            writeFileSync(
                join(dir, 'index.html'),
                render(template, {
                    path: `/program/${meta.id}/yil/guncel/ders/${slugify(code)}`,
                    // "X dersinden kalirsam ne olur" bir soru; arama sonucunda
                    // cevabiyla birlikte gorunsun.
                    jsonLd: faqJsonLd(program, code),
                    title:
                        `${code} dersinden kalirsan ne olur? | ${program.name} `
                        + '| DEU On Kosul',
                    description:
                        `${program.name} bolumunde ${code} `
                        + `${graph.byCode.get(code)?.name ?? ''} dersinden kalinca hangi `
                        + 'dersler kilitlenir.',
                    body: resultBody(program, code),
                }),
                'utf-8',
            )
            results += 1
            sitemap.push(`/program/${meta.id}/yil/guncel/ders/${slugify(code)}`)
        }

        links.push(
            `<li><a href="/program/${meta.id}">${esc(meta.name)}</a> `
            + `&ndash; ${esc(meta.faculty)}`
            + (meta.prereqCount ? ` (en fazla ${meta.maxLocked} ders kilitlenir)` : '')
            + '</li>',
        )
    }

    // Giris sayfasi: bu olmadan arama motoru tekil bolum sayfalarina giden bir
    // baglanti bulamaz.
    writeFileSync(
        join(DIST, 'index.html'),
        render(template, {
            path: '/',
            title: 'DEU on kosullu dersler | Hangi dersten kalinca ne olur',
            description:
                'Dokuz Eylul Universitesi bolumlerinin on kosullu ders zincirleri. '
                + 'Hangi dersten kalinca hangi dersleri alamazsin, zincir kac yariyil '
                + 'ileri gider.',
            body:
                '<h1>Hangi dersten kalirsan hangi dersleri alamazsin?</h1>\n'
                + '<p>On kosullu bir dersi gecmeden ustundeki dersi alamazsin. '
                + 'Bolumunu sec, kendi zincirini gor.</p>\n<ul>\n'
                + links.join('\n')
                + '\n</ul>',
        }),
        'utf-8',
    )

    // sitemap.xml ve robots.txt
    const today = new Date().toISOString().slice(0, 10)
    writeFileSync(
        join(DIST, 'sitemap.xml'),
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + sitemap
            .map(
                (u) =>
                    `  <url><loc>${esc(SITE + u)}</loc>`
                    + `<lastmod>${today}</lastmod></url>`,
            )
            .join('\n')
        + '\n</urlset>\n',
        'utf-8',
    )
    writeFileSync(
        join(DIST, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
        'utf-8',
    )

    console.log(`Prerender: ${written} bolum sayfasi + giris sayfasi`)
    console.log(`  sitemap girisi          : ${sitemap.length}`)
    console.log(`  site adresi             : ${SITE}`)
    console.log(`  zinciri olan bolum      : ${withChain}`)
    console.log(`  yalniz metin sarti olan : ${withNote}`)
    console.log(`  sonuc sayfasi           : ${results}`)
    return 0
}

process.exit(main())
