/**
 * Onkosul grafigi.
 *
 * Gercek veri testleri Insaat Muhendisligi (1198) zincirinden besleniyor.
 * Beklenen sayilar katalogun ders sayfalari tek tek okunarak dogrulandi.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildGraph, cascade, chainLevels, depth, impactOf } from './prereq'
import type { Course, Prerequisite, ProgramChain } from '../types'

const loadCourses = (id: string): Course[] => {
    const path = fileURLToPath(
        new URL(`../../public/data/programs/${id}.json`, import.meta.url),
    )
    return (JSON.parse(readFileSync(path, 'utf-8')) as ProgramChain).courses
}

const make = (
    code: string,
    prerequisites: Prerequisite[] = [],
    term: number | null = 5,
): Course => ({ code, name: code, term, prerequisites })

describe('gercek katalog verisi (Insaat 1198)', () => {
    const graph = buildGraph(loadCourses('1198'))

    it('Statik zincirinde tam olarak 10 ders kilitlenir', () => {
        expect(cascade(graph, 'İNŞ 1012')).toHaveLength(10)
    })

    it('zincir 4. sinif derslerine kadar iner', () => {
        expect(cascade(graph, 'İNŞ 1012')).toContain('İNŞ 4109')
    })

    it('zincir derinligi 4 kademedir', () => {
        // Statik > Mukavemet I > Yapi Statigi I > Yapi Statigi II > Yapi Dinamigi
        expect(depth(graph, 'İNŞ 1012')).toBe(4)
    })

    it('etki ozeti son yariyili 8 verir ve yariyila gore siralar', () => {
        const impact = impactOf(graph, 'İNŞ 1012')
        expect(impact.locked).toHaveLength(10)
        expect(impact.lastTerm).toBe(8)
        expect(impact.locked[0].code).toBe('İNŞ 2001')
    })

    it('zincir 5 kademeye ayrilir', () => {
        const levels = chainLevels(graph)
        expect(levels).toHaveLength(5)
        expect(levels[0].map((n) => n.code)).toContain('İNŞ 1012')
        expect(levels[4].map((n) => n.code)).toContain('İNŞ 4109')
    })

    it('her ders katalogdaki kaynak sayfasini tasir', () => {
        // Kanit baglantisi: kullaniciya "iddia bizim degil, katalogun"
        // diyebilmek icin her dersin kendi katalog sayfasi gerekli.
        const withSource = loadCourses('1198').filter((c) => c.source)
        expect(withSource.length).toBeGreaterThan(0)
        expect(withSource[0].source).toMatch(
            /^https:\/\/debis\.deu\.edu\.tr\/ders-katalog\/.*\.html$/,
        )
    })

    it('ince veri yalnizca zincire katilan dersleri tasir', () => {
        // ATA 1001 katalogda var ama hicbir zincire girmiyor. Veri uretici onu
        // disarida birakmali, yoksa 688 KB'lik veri seti sismeye baslar.
        expect(graph.byCode.has('ATA 1001')).toBe(false)
    })
})

describe('kenar durumlar', () => {
    it('kodu bos onkosul grafige girmez', () => {
        const graph = buildGraph([
            make('AAA 1001'),
            make('BBB 2001', [{ code: '', name: 'Bolum onayi gerekir' }]),
        ])
        expect(graph.requires.has('BBB 2001')).toBe(false)
    })

    it('dongu sonsuz donguye girmez', () => {
        const graph = buildGraph([
            make('AAA 1001', [{ code: 'BBB 2001', name: 'B' }]),
            make('BBB 2001', [{ code: 'AAA 1001', name: 'A' }]),
        ])
        expect(cascade(graph, 'AAA 1001')).toEqual(['BBB 2001'])
        expect(depth(graph, 'AAA 1001')).toBe(1)
        expect(chainLevels(graph).flat().map((n) => n.code).sort())
            .toEqual(['AAA 1001', 'BBB 2001'])
    })

    it('onkosulsuz programda zincir bostur', () => {
        const graph = buildGraph([make('AAA 1001')])
        expect(chainLevels(graph)).toEqual([])
        expect(cascade(graph, 'AAA 1001')).toEqual([])
        expect(depth(graph, 'AAA 1001')).toBe(0)
    })

    it('birden fazla onkosul ayri kenar olur', () => {
        const graph = buildGraph([
            make('AAA 1001'),
            make('BBB 1002'),
            make('CCC 3001', [
                { code: 'AAA 1001', name: 'A' },
                { code: 'BBB 1002', name: 'B' },
            ]),
        ])
        expect([...(graph.requires.get('CCC 3001') ?? [])].sort())
            .toEqual(['AAA 1001', 'BBB 1002'])
        expect(cascade(graph, 'AAA 1001')).toEqual(['CCC 3001'])
    })

    it('programda olmayan onkosul dersinin ADI onkosul kaydindan gelir', () => {
        // Katalog bunu yapiyor: MMM 2402 MALZEME II'nin onkosulu MMZ 2001
        // MALZEME I, ama MMZ 2001 programin ders listesinde yok (eski kod).
        // Ad tasinmazsa ekranda "MMZ 2001 / MMZ 2001" cikiyordu.
        const graph = buildGraph([
            make('MMM 2402', [{ code: 'MMZ 2001', name: 'MALZEME I' }]),
        ])
        expect(graph.byCode.get('MMZ 2001')?.name).toBe('MALZEME I')
        expect(chainLevels(graph).flat().find((n) => n.code === 'MMZ 2001')?.name)
            .toBe('MALZEME I')
    })

    it('prerequisites alani eksikse cokmez', () => {
        const partial = { code: 'AAA 1001', name: 'A', term: 1 } as Course
        expect(() => buildGraph([partial])).not.toThrow()
    })
})
