/**
 * Veri yukleyici.
 *
 * index.json 647 programin ozeti (~60 KB), acilista bir kez cekilir.
 * Zincir dosyalari yalnizca o program secildiginde cekilir.
 */

import type { DataIndex, ProgramChain } from '../types'

const cache = new Map<string, ProgramChain>()
let indexPromise: Promise<DataIndex> | null = null

export function loadIndex(): Promise<DataIndex> {
    if (!indexPromise) {
        indexPromise = fetch(`${import.meta.env.BASE_URL}data/index.json`)
            .then((res) => {
                if (!res.ok) throw new Error(`Program listesi alinamadi (${res.status})`)
                return res.json() as Promise<DataIndex>
            })
            .catch((err) => {
                // Basarisiz promise cache'te kalirsa bir daha denenemez.
                indexPromise = null
                throw err
            })
    }
    return indexPromise
}

export async function loadProgram(id: string): Promise<ProgramChain> {
    const hit = cache.get(id)
    if (hit) return hit

    const res = await fetch(`${import.meta.env.BASE_URL}data/programs/${id}.json`)
    if (!res.ok) throw new Error(`Program zinciri alinamadi (${res.status})`)

    const data = (await res.json()) as ProgramChain
    cache.set(id, data)
    return data
}
