/**
 * Giris yili -> plan surumu eslemesi ve arsiv verisinin dogrulugu.
 *
 * Gercek veri testleri Insaat (1198) arsivinden besleniyor. Beklenen kod
 * degisimleri PDF'lerin kendisinden okundu.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CATALOG_FROM, entryYearOptions, planForYear } from './planVersion'
import type { ProgramChain, ProgramPlans } from '../types'

const read = <T>(rel: string): T =>
    JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')) as T

const plans = read<ProgramPlans>('../../public/data/plans/1198.json')
const current = read<ProgramChain>('../../public/data/programs/1198.json')

const codesOf = (v: { courses: { code: string }[] }) => new Set(v.courses.map((c) => c.code))

describe('Insaat arsiv verisi', () => {
    it('surumler bosluksuz ve ust uste binmeden siralanir', () => {
        const v = plans.versions
        expect(v.length).toBeGreaterThan(1)
        for (let i = 0; i < v.length - 1; i += 1) {
            expect(v[i].validTo).toBe(v[i + 1].validFrom - 1)
        }
        // Son tarihsel surum, katalogun devraldigi yila kadar gitmeli.
        expect(v[v.length - 1].validTo).toBe(CATALOG_FROM - 1)
    })

    it('2024 oncesi surumlerde ESKI ders kodlari vardir', () => {
        // 2024'teki toplu yeniden numaralandirmadan once.
        const v2023 = plans.versions.find((x) => x.validFrom === 2023)
        expect(v2023).toBeDefined()
        const codes = codesOf(v2023!)
        expect(codes.has('İNŞ 2014')).toBe(true)   // AKISKANLAR MEKANIGI
        expect(codes.has('İNŞ 4009')).toBe(true)   // YAPI DINAMIGI
        expect(codes.has('İNŞ 2114')).toBe(false)
        expect(codes.has('İNŞ 4109')).toBe(false)
    })

    it('guncel katalogda YENI ders kodlari vardir', () => {
        const codes = codesOf(current)
        expect(codes.has('İNŞ 2114')).toBe(true)
        expect(codes.has('İNŞ 4109')).toBe(true)
    })

    it('arsiv plani yariyil bilgisi tasir ve katalogla tutar', () => {
        // PDF yariyili "UCUNCU YARIYIL" diye yaziyla yaziyor; sutun konumundan
        // eslestiriliyor. Tasinmazsa sonuc ekraninda "Son yariyil" kayboluyor.
        const v2020 = plans.versions.find((x) => x.validFrom === 2020)!
        const byCode = new Map(v2020.courses.map((c) => [c.code, c]))
        expect(byCode.get('İNŞ 1012')?.term).toBe(2)   // STATIK
        expect(byCode.get('İNŞ 2001')?.term).toBe(3)   // MUKAVEMET I
        expect(byCode.get('İNŞ 3007')?.term).toBe(5)   // YAPI STATIGI I

        // Guncel katalogla ayni yariyillar.
        const cur = new Map(current.courses.map((c) => [c.code, c]))
        for (const code of ['İNŞ 1012', 'İNŞ 2001', 'İNŞ 3007']) {
            expect(byCode.get(code)?.term).toBe(cur.get(code)?.term)
        }
    })

    it('her plan surumu kaynak PDF adresini tasir', () => {
        for (const v of plans.versions) {
            expect(v.source).toMatch(/^https:\/\/eng\.deu\.edu\.tr\/.*\.pdf$/)
        }
    })

    it('eski planlar daha cok on kosul iceriyordu', () => {
        // 2020 plani elektif derslere de on kosul koymus, 2024 kaldirmis.
        const v2020 = plans.versions.find((x) => x.validFrom === 2020)
        const eski = v2020!.courses.filter((c) => c.prerequisites.length).length
        const yeni = current.courses.filter((c) => c.prerequisites.some((p) => p.code)).length
        expect(eski).toBeGreaterThan(yeni)
    })
})

describe('planForYear', () => {
    it('katalog donemindeki yil icin katalogu secer', () => {
        expect(planForYear(plans, CATALOG_FROM).kind).toBe('catalog')
        expect(planForYear(plans, CATALOG_FROM + 3).kind).toBe('catalog')
    })

    it('arsiv yilinda dogru surumu secer', () => {
        const r = planForYear(plans, 2021)
        expect(r.kind).toBe('archive')
        if (r.kind !== 'archive') throw new Error('archive bekleniyordu')
        expect(r.version.validFrom).toBe(2020)
        expect(r.version.validTo).toBe(2022)
    })

    it('surum sinirlarinda dogru tarafi secer', () => {
        const a = planForYear(plans, 2022)
        const b = planForYear(plans, 2023)
        if (a.kind !== 'archive' || b.kind !== 'archive') throw new Error('archive bekleniyordu')
        expect(a.version.validFrom).toBe(2020)
        expect(b.version.validFrom).toBe(2023)
    })

    it('arsivden eski yil icin tahminde bulunmaz', () => {
        expect(planForYear(plans, 1999).kind).toBe('unknown')
    })

    it('arsivi olmayan bolumde eski yil icin unknown doner', () => {
        expect(planForYear(null, 2021).kind).toBe('unknown')
    })

    it('arsivi olmayan bolumde guncel yil icin yine katalog doner', () => {
        expect(planForYear(null, CATALOG_FROM + 1).kind).toBe('catalog')
    })
})

describe('entryYearOptions', () => {
    it('bu yildan arsivin basina kadar yeniden eskiye listeler', () => {
        const ys = entryYearOptions(plans, 2026)
        expect(ys[0]).toBe(2026)
        expect(ys[ys.length - 1]).toBe(plans.versions[0].validFrom)
        expect(ys).toEqual([...ys].sort((a, b) => b - a))
    })

    it('arsiv yoksa bos doner, arayuz yil adimini atlar', () => {
        expect(entryYearOptions(null)).toEqual([])
    })
})
