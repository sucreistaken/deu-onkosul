/**
 * Giris ekrani: tek is, bolumunu bul.
 *
 * Arama kutusu + sonuc listesi. Acilir menu yerine duz liste, cunku tek
 * hamlede secilebilsin: yaz, tikla, bitti.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Card, Form, ListGroup, Spinner } from 'react-bootstrap'
import { Search } from 'react-bootstrap-icons'
import { loadIndex } from '../lib/data'
import type { DataIndex, ProgramMeta } from '../types'

/** Turkce arama: buyuk/kucuk ve aksan farkini yok sayar. */
const fold = (s: string): string =>
    s
        .toLocaleLowerCase('tr')
        .replace(/[ıi̇]/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')

const LockedBadge: React.FC<{ meta: ProgramMeta }> = ({ meta }) => {
    if (meta.prereqCount === 0) {
        // Zincir kurmayan ama gercek olan sartlar (orn. hazirlik sinifi) burada
        // "on kosul yok" diye gosterilmemeli.
        const label = meta.noteCount > 0 ? 'hazirlik / metin sarti' : 'on kosul yok'
        return (
            <Badge bg="secondary-subtle" text="secondary-emphasis" className="align-self-start">
                {label}
            </Badge>
        )
    }
    const bg = meta.maxLocked >= 5 ? 'danger' : meta.maxLocked >= 2 ? 'warning' : 'primary'
    const text = meta.maxLocked >= 2 && meta.maxLocked < 5 ? 'dark' : undefined
    return (
        <Badge bg={bg} text={text} className="align-self-start text-wrap">
            en fazla {meta.maxLocked} ders kilitlenir
        </Badge>
    )
}

const Home: React.FC = () => {
    const [index, setIndex] = useState<DataIndex | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')

    useEffect(() => {
        loadIndex().then(setIndex).catch((err: Error) => setError(err.message))
    }, [])

    const results = useMemo(() => {
        if (!index) return []
        const q = fold(query.trim())
        // Arama bosken listeyi bosaltmak yerine en riskli programlari goster:
        // ziyaretcinin hemen tiklayabilecegi bir sey olsun.
        const pool = q
            ? index.programs.filter(
                (p) => fold(p.name).includes(q) || fold(p.faculty).includes(q),
            )
            : index.programs.filter((p) => p.prereqCount > 0)
        return pool.slice(0, 25)
    }, [index, query])

    if (error) {
        return <Alert variant="danger">Program listesi yuklenemedi: {error}</Alert>
    }

    return (
        <>
            <div className="mb-4">
                <h1 className="h3 fw-semibold mb-2">
                    Hangi dersten kalirsan hangi dersleri alamazsin?
                </h1>
                <p className="text-body-secondary mb-0">
                    On kosullu bir dersi gecmeden ustundeki dersi alamazsin. Zincir birkac
                    yariyil ileri gidebilir. Bolumunu sec, kendi zincirini gor.
                </p>
            </div>

            <Card className="mb-4 shadow-sm">
                <Card.Body>
                    <Form.Label htmlFor="program-search" className="fw-medium">
                        Bolumunu ara
                    </Form.Label>
                    <div className="position-relative">
                        <Search
                            className="position-absolute top-50 translate-middle-y ms-3 text-body-secondary"
                            aria-hidden
                        />
                        <Form.Control
                            id="program-search"
                            size="lg"
                            className="ps-5"
                            placeholder="Insaat, Isletme, Grafik..."
                            autoComplete="off"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                </Card.Body>
            </Card>

            {!index ? (
                <div className="text-center py-5">
                    <Spinner animation="border" role="status" />
                </div>
            ) : (
                <>
                    <h2 className="h6 text-body-secondary text-uppercase mb-2">
                        {query.trim()
                            ? `${results.length} sonuc`
                            : 'En agir zincire sahip bolumler'}
                    </h2>

                    {results.length === 0 ? (
                        <Alert variant="light" className="border">
                            Bu aramaya uyan bolum yok. Fakulte adiyla da arayabilirsin.
                        </Alert>
                    ) : (
                        <ListGroup className="shadow-sm">
                            {results.map((p) => (
                                <ListGroup.Item
                                    key={p.id}
                                    action
                                    as={Link}
                                    to={`/program/${p.id}`}
                                    className="d-flex flex-column flex-sm-row justify-content-sm-between align-items-sm-center gap-1 gap-sm-3"
                                >
                                    <span>
                                        <span className="fw-medium">{p.name}</span>
                                        <span className="text-body-secondary small d-block">
                                            {p.faculty} &middot; {p.levelLabel}
                                        </span>
                                    </span>
                                    <LockedBadge meta={p} />
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}

                    <p className="text-body-secondary small mt-3 mb-0">
                        DEU Ders Katalogu {index.catalogYear} &middot; {index.programs.length} program
                    </p>
                </>
            )}
        </>
    )
}

export default Home
