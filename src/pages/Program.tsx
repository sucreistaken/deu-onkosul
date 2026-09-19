/**
 * Adim adim sihirbaz.
 *
 *   /program/:id                       1) Bolum onayi
 *   /program/:id/yil                   2) Giris yili   (arsiv yoksa atlanir)
 *   /program/:id/yil/:year/ders        3) Hangi dersten kaldin
 *   /program/:id/yil/:year/ders/:code  4) Sonuc
 *
 * Her adimin kendi adresi var: paylasilabilir, geri tusu calisir, prerender
 * edilebilir. Ekranda ayni anda tek soru durur; zincir haritasi ve siralama
 * sonuc ekraninda kapali bir bolumde bekler.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
    Alert, Badge, Button, Card, Col, Collapse, Form, ListGroup, Row, Spinner, Table,
} from 'react-bootstrap'
import { ArrowRight, ExclamationTriangleFill, LockFill } from 'react-bootstrap-icons'
import { loadPlans, loadProgram } from '../lib/data'
import { buildGraph, cascade, chainLevels, depth, impactOf } from '../lib/prereq'
import { CATALOG_FROM, entryYearOptions, planForYear } from '../lib/planVersion'
import { findBySlug, slugify } from '../lib/slug'
import WizardSteps, { type Step } from '../components/WizardSteps'
import type { Course, ProgramChain, ProgramPlans } from '../types'

/** Arsivi olmayan bolumlerde adresteki yil parcasi. */
const CURRENT = 'guncel'

const Program: React.FC = () => {
    const { id, year, code: codeSlug } = useParams<{ id: string; year: string; code: string }>()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    // "/program/1198/yil" rotasinda :year parametresi yok; adimi adresten anlariz.
    const onYearStep = /\/yil\/?$/.test(pathname)

    const [program, setProgram] = useState<ProgramChain | null>(null)
    const [plans, setPlans] = useState<ProgramPlans | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [showDetail, setShowDetail] = useState(false)

    useEffect(() => {
        if (!id) return
        let cancelled = false
        setLoading(true)
        setError(null)

        Promise.all([loadProgram(id), loadPlans(id)])
            .then(([p, pl]) => {
                if (cancelled) return
                setProgram(p)
                setPlans(pl)
            })
            .catch((err: Error) => !cancelled && setError(err.message))
            .finally(() => !cancelled && setLoading(false))

        return () => { cancelled = true }
    }, [id])

    const years = useMemo(() => entryYearOptions(plans), [plans])
    const entryYear = year && year !== CURRENT ? Number(year) : null

    /** Secilen yila gore hangi ders listesi gecerli. */
    const choice = useMemo(
        () => (entryYear !== null ? planForYear(plans, entryYear) : { kind: 'catalog' as const }),
        [plans, entryYear],
    )

    const courses: Course[] = useMemo(() => {
        if (choice.kind === 'archive') return choice.version.courses
        return program?.courses ?? []
    }, [choice, program])

    const graph = useMemo(() => buildGraph(courses), [courses])

    const risky = useMemo(
        () =>
            [...graph.dependents.keys()]
                .map((c) => ({
                    code: c,
                    name: graph.byCode.get(c)?.name ?? c,
                    term: graph.byCode.get(c)?.term ?? null,
                    locked: cascade(graph, c).length,
                    depth: depth(graph, c),
                }))
                .sort((a, b) => b.locked - a.locked || a.code.localeCompare(b.code)),
        [graph],
    )

    const selected = codeSlug ? findBySlug([...graph.byCode.keys()], codeSlug) : null
    const impact = useMemo(
        () => (selected ? impactOf(graph, selected) : null),
        [graph, selected],
    )

    /** On kosulu ders degil de serbest metin olanlar (orn. hazirlik sinifi). */
    const notes = useMemo(
        () => courses.filter((c) => c.prerequisites.length > 0 && !c.prerequisites.some((p) => p.code)),
        [courses],
    )

    if (loading) {
        return <div className="text-center py-5"><Spinner animation="border" role="status" /></div>
    }

    if (error || !program) {
        return (
            <Alert variant="danger">
                <Alert.Heading className="h5">Bolum bulunamadi</Alert.Heading>
                <p className="mb-2">{error}</p>
                <Link to="/">Bolum listesine don</Link>
            </Alert>
        )
    }

    const base = `/program/${program.id}`
    const hasArchive = years.length > 0
    // Arsiv yoksa yil adimi hic gosterilmez; kullaniciya cevaplayamayacagi
    // soruyu sormanin anlami yok.
    const stepLabels: Step[] = hasArchive
        ? [
            { label: 'Bolum', to: base },
            { label: 'Giris yili', to: `${base}/yil` },
            { label: 'Ders', to: year ? `${base}/yil/${year}/ders` : undefined },
            { label: 'Sonuc' },
        ]
        : [
            { label: 'Bolum', to: base },
            { label: 'Ders', to: `${base}/yil/${CURRENT}/ders` },
            { label: 'Sonuc' },
        ]

    const stepIndex = codeSlug
        ? stepLabels.length - 1
        : year
            ? stepLabels.length - 2
            : onYearStep
                ? 1
                : 0

    const header = (
        <>
            <nav className="mb-2"><Link to="/" className="small">&larr; Tum bolumler</Link></nav>
            <h1 className="h4 fw-semibold mb-1">{program.name}</h1>
            <p className="text-body-secondary small">
                {program.faculty} &middot; {program.levelLabel}
                {choice.kind === 'archive' && ` · ${choice.version.label} ogretim plani`}
                {choice.kind === 'catalog' && ` · DEU Ders Katalogu ${program.catalogYear}`}
            </p>
            <WizardSteps steps={stepLabels} current={stepIndex} />
        </>
    )

    // ---- Adim 1: bolum onayi -------------------------------------------
    if (!year && !onYearStep) {
        const next = hasArchive ? `${base}/yil` : `${base}/yil/${CURRENT}/ders`
        return (
            <>
                {header}
                <Card className="shadow-sm">
                    <Card.Body>
                        <p className="mb-1 fw-medium">Bolumun bu mu?</p>
                        <p className="text-body-secondary small mb-3">
                            {risky.length > 0
                                ? `Bu bolumde ${risky.length} dersin on kosulu var. Bir dersten `
                                  + 'kalirsan ustundeki dersleri alamazsin.'
                                : 'Bu bolum icin katalogda on kosul tanimli degil.'}
                        </p>
                        <div className="d-flex gap-2 flex-wrap">
                            <Link to={next} className="btn btn-primary btn-lg">
                                Evet, devam et
                            </Link>
                            <Link to="/" className="btn btn-outline-secondary btn-lg">
                                Baska bolum sec
                            </Link>
                        </div>
                    </Card.Body>
                </Card>
            </>
        )
    }

    // ---- Adim 2: giris yili --------------------------------------------
    if (onYearStep) {
        return (
            <>
                {header}
                <Card className="shadow-sm">
                    <Card.Body>
                        <p className="fw-medium mb-1">Kac girislisin?</p>
                        <p className="text-body-secondary small mb-3">
                            Ogretim plani zaman icinde degisti. Dogru ders kodlarini
                            gorebilmek icin universiteye baslama yilini sec.
                        </p>
                        <div className="d-flex flex-wrap gap-2">
                            {years.map((y) => (
                                <Link
                                    key={y}
                                    to={`${base}/yil/${y}/ders`}
                                    className={
                                        y >= CATALOG_FROM
                                            ? 'btn btn-primary'
                                            : 'btn btn-outline-primary'
                                    }
                                >
                                    {y}
                                </Link>
                            ))}
                        </div>
                        <Form.Text>
                            {CATALOG_FROM} ve sonrasi guncel plani kullanir; daha eskiler
                            o yil yururlukte olan plani.
                        </Form.Text>
                    </Card.Body>
                </Card>
            </>
        )
    }

    // ---- Adim 3: ders secimi -------------------------------------------
    if (!codeSlug) {
        return (
            <>
                {header}
                {notes.length > 0 && (
                    <Alert variant="info">
                        <Alert.Heading className="h6">
                            Ders disi sart: {notes[0].prerequisites[0].name}
                        </Alert.Heading>
                        <ul className="mb-0 small">
                            {notes.map((c) => (
                                <li key={c.code}><strong>{c.code}</strong> {c.name}</li>
                            ))}
                        </ul>
                    </Alert>
                )}

                {risky.length === 0 ? (
                    <Alert variant="secondary">
                        <Alert.Heading className="h6">Katalogda tanimli on kosul yok</Alert.Heading>
                        <p className="mb-0">
                            DEU Ders Katalogu bu bolumun hicbir dersinde on kosul tanimlamamis.
                            Bu, fakultenin kendi ogretim ve sinav uygulama esaslarinda bir kosul
                            olmadigi anlamina gelmez; emin olmak icin danismanina sor.
                        </p>
                    </Alert>
                ) : (
                    <Card className="shadow-sm">
                        <Card.Body>
                            <Form.Label htmlFor="ders" className="fw-medium">
                                Hangi dersten kaldin?
                            </Form.Label>
                            <Form.Select
                                id="ders"
                                size="lg"
                                defaultValue=""
                                onChange={(e) =>
                                    e.target.value &&
                                    navigate(`${base}/yil/${year}/ders/${slugify(e.target.value)}`)
                                }
                            >
                                <option value="">Ders sec...</option>
                                {risky.map((r) => (
                                    <option key={r.code} value={r.code}>
                                        {r.code} - {r.name}
                                    </option>
                                ))}
                            </Form.Select>
                            <Form.Text>
                                Listede yalnizca baska bir derse on kosul olan dersler var.
                                Digerlerinden kalmak zinciri etkilemez.
                            </Form.Text>
                        </Card.Body>
                    </Card>
                )}
            </>
        )
    }

    // ---- Adim 4: sonuc -------------------------------------------------
    if (!impact) {
        return (
            <>
                {header}
                <Alert variant="warning">
                    Bu ders bulunamadi.{' '}
                    <Link to={`${base}/yil/${year}/ders`}>Ders secimine don</Link>
                </Alert>
            </>
        )
    }

    return (
        <>
            {header}

            <Alert variant={impact.locked.length >= 5 ? 'danger' : 'warning'}>
                <Alert.Heading className="h5 d-flex align-items-center gap-2">
                    <ExclamationTriangleFill />
                    {impact.code} {impact.name} dersinden kalirsan {impact.locked.length} ders
                    kilitlenir
                </Alert.Heading>

                <Row className="g-3 my-1">
                    <Col xs={4}>
                        <div className="small text-uppercase opacity-75">Kilitlenen</div>
                        <div className="fs-3 fw-semibold">{impact.locked.length}</div>
                    </Col>
                    <Col xs={4}>
                        <div className="small text-uppercase opacity-75">Zincir</div>
                        <div className="fs-3 fw-semibold">{impact.depth} kademe</div>
                    </Col>
                    {impact.lastTerm !== null && (
                        <Col xs={4}>
                            <div className="small text-uppercase opacity-75">Son yariyil</div>
                            <div className="fs-3 fw-semibold">{impact.lastTerm}</div>
                        </Col>
                    )}
                </Row>

                <ListGroup variant="flush" className="mt-2">
                    {impact.locked.map((c) => (
                        <ListGroup.Item
                            key={c.code}
                            className="bg-transparent px-0 py-1 border-0 d-flex align-items-center gap-2"
                        >
                            <LockFill size={14} className="flex-shrink-0 opacity-75" />
                            <span>
                                <strong>{c.code}</strong> {c.name}
                                {c.term !== null && (
                                    <span className="opacity-75"> ({c.term}. yariyil)</span>
                                )}
                            </span>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            </Alert>

            {choice.kind === 'unknown' && (
                <Alert variant="secondary" className="small">
                    {entryYear} girisi icin plan arsivimizde kayit yok; yukaridaki sonuc
                    guncel plana gore. Ders kodlarin farkli olabilir.
                </Alert>
            )}
            {!hasArchive && (
                <Alert variant="secondary" className="small">
                    Bu bolum icin yalnizca {program.catalogYear} plani var. Daha eski
                    girisliysen ders kodlarin farkli olabilir.
                </Alert>
            )}
            {choice.kind === 'archive' && (
                <Alert variant="secondary" className="small">
                    {entryYear} girisinde yururlukte olan plan {choice.version.label} idi ve
                    sonuc ona gore hesaplandi. Sana hangi planin uygulandigini danismanindan
                    teyit et.
                </Alert>
            )}

            <div className="d-flex gap-2 flex-wrap my-3">
                <Link to={`${base}/yil/${year}/ders`} className="btn btn-outline-primary">
                    Baska ders sec
                </Link>
                <Button variant="outline-secondary" onClick={() => setShowDetail((v) => !v)}>
                    {showDetail ? 'Detayi gizle' : 'Detayi goster'}
                </Button>
            </div>

            <Collapse in={showDetail}>
                <div>
                    <Card className="shadow-sm mb-3">
                        <Card.Header className="fw-medium">
                            Kalinca en cok ders kilitleyenler
                        </Card.Header>
                        <div className="table-responsive">
                            <Table hover className="mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th>Ders</th>
                                        <th className="text-nowrap">Yariyil</th>
                                        <th className="text-nowrap">Kilitlenen</th>
                                        <th className="text-nowrap">Zincir</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {risky.map((r) => (
                                        <tr key={r.code}>
                                            <td><strong>{r.code}</strong> {r.name}</td>
                                            <td>{r.term ?? '-'}</td>
                                            <td>
                                                <Badge
                                                    bg={r.locked >= 5 ? 'danger' : r.locked >= 2 ? 'warning' : 'primary'}
                                                    text={r.locked >= 2 && r.locked < 5 ? 'dark' : undefined}
                                                >
                                                    {r.locked}
                                                </Badge>
                                            </td>
                                            <td>{r.depth} kademe</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </Card>

                    <Card className="shadow-sm">
                        <Card.Header className="fw-medium">On kosul zinciri</Card.Header>
                        <Card.Body>
                            <p className="text-body-secondary small">
                                Soldaki dersi gecmeden sagindakini alamazsin.
                            </p>
                            <div className="chain-scroll d-flex gap-3 pb-2">
                                {chainLevels(graph).map((level, i) => (
                                    <div key={i} className="chain-col">
                                        <div className="small text-uppercase text-body-secondary mb-2">
                                            {i + 1}. kademe
                                        </div>
                                        <div className="d-flex flex-column gap-2">
                                            {level.map((node) => (
                                                <div key={node.code} className="border rounded p-2 bg-body">
                                                    <div className="fw-semibold small">{node.code}</div>
                                                    <div className="small">{node.name}</div>
                                                    {node.term !== null && (
                                                        <div className="small text-body-secondary">
                                                            {node.term}. yariyil
                                                        </div>
                                                    )}
                                                    {node.requires.length > 0 && (
                                                        <div className="small text-body-secondary mt-1">
                                                            <ArrowRight size={12} /> on kosul:{' '}
                                                            {node.requires.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </Collapse>
        </>
    )
}

export default Program
