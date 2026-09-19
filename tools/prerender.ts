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
import { buildGraph, cascade, chainLevels, depth } from '../src/lib/prereq'
import type { DataIndex, ProgramChain } from '../src/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
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
    opts: { title: string; description: string; body: string },
): string {
    return template
        .replace(/<title>.*?<\/title>/s, `<title>${esc(opts.title)}</title>`)
        .replace(
            /<meta name="description"[\s\S]*?\/>/,
            `<meta name="description" content="${esc(opts.description)}" />`,
        )
        .replace('<div id="root"></div>', `<div id="root">${opts.body}</div>`)
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
    const links: string[] = []

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

    console.log(`Prerender: ${written} bolum sayfasi + giris sayfasi`)
    console.log(`  zinciri olan bolum      : ${withChain}`)
    console.log(`  yalniz metin sarti olan : ${withNote}`)
    return 0
}

process.exit(main())
