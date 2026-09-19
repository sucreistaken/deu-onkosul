/**
 * Bir bolumun on kosul haritasi: /program/:id
 *
 * Sayfanin ilk isi soruyu cevaplamak: hangi dersten kaldin, ne oldu.
 * Zincir ve siralama altta, merak edene.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
    Alert, Badge, Card, Col, Form, ListGroup, Row, Spinner, Table,
} from 'react-bootstrap'
import { ArrowRight, ExclamationTriangleFill, LockFill } from 'react-bootstrap-icons'
import { loadProgram } from '../lib/data'
import { buildGraph, cascade, chainLevels, depth, impactOf } from '../lib/prereq'
import type { ProgramChain } from '../types'

const Program: React.FC = () => {
    const { id } = useParams<{ id: string }>()
    const [program, setProgram] = useState<ProgramChain | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [failed, setFailed] = useState('')

    useEffect(() => {
        if (!id) return
        let cancelled = false
        setProgram(null)
        setError(null)
        setFailed('')

        loadProgram(id)
            .then((d) => !cancelled && setProgram(d))
            .catch((err: Error) => !cancelled && setError(err.message))

        return () => {
            cancelled = true
        }
    }, [id])

    const graph = useMemo(() => buildGraph(program?.courses ?? []), [program])
    const levels = useMemo(() => chainLevels(graph), [graph])

    /** Kalinca en cok ders kilitleyenler; sayfanin asil bilgisi. */
    const risky = useMemo(
        () =>
            [...graph.dependents.keys()]
                .map((code) => ({
                    code,
                    name: graph.byCode.get(code)?.name ?? code,
                    term: graph.byCode.get(code)?.term ?? null,
                    locked: cascade(graph, code).length,
                    depth: depth(graph, code),
                }))
                .sort((a, b) => b.locked - a.locked || a.code.localeCompare(b.code)),
        [graph],
    )

    const impact = useMemo(
        () => (failed ? impactOf(graph, failed) : null),
        [graph, failed],
    )

    /** On kosulu ders degil de serbest metin olan dersler (orn. hazirlik sinifi). */
    const notes = useMemo(
        () =>
            (program?.courses ?? []).filter(
                (c) => c.prerequisites.length > 0 && !c.prerequisites.some((p) => p.code),
            ),
        [program],
    )

    if (error) {
        return (
            <Alert variant="danger">
                <Alert.Heading className="h5">Bolum bulunamadi</Alert.Heading>
                <p className="mb-2">{error}</p>
                <Link to="/">Bolum listesine don</Link>
            </Alert>
        )
    }

    if (!program) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" role="status" />
            </div>
        )
    }

    return (
        <>
            <nav aria-label="breadcrumb" className="mb-2">
                <Link to="/" className="small">&larr; Tum bolumler</Link>
            </nav>

            <h1 className="h3 fw-semibold mb-1">{program.name}</h1>
            <p className="text-body-secondary">
                {program.faculty} &middot; {program.levelLabel} &middot; DEU Ders Katalogu{' '}
                {program.catalogYear}
            </p>

            {notes.length > 0 && (
                <Alert variant="info">
                    <Alert.Heading className="h6">
                        Ders disi sart: {notes[0].prerequisites[0].name}
                    </Alert.Heading>
                    <p className="mb-2">
                        Su derslerin on kosulu bir ders degil, katalogda serbest metin
                        olarak yazilmis. Zincire giremez ama gercek bir sarttir.
                    </p>
                    <ul className="mb-0 small">
                        {notes.map((c) => (
                            <li key={c.code}>
                                <strong>{c.code}</strong> {c.name}
                            </li>
                        ))}
                    </ul>
                </Alert>
            )}

            {risky.length === 0 ? (
                notes.length === 0 && (
                    <Alert variant="secondary">
                        <Alert.Heading className="h6">
                            Katalogda tanimli on kosul yok
                        </Alert.Heading>
                        <p className="mb-0">
                            DEU Ders Katalogu bu bolumun hicbir dersinde on kosul
                            tanimlamamis. Bu, fakultenin kendi ogretim ve sinav uygulama
                            esaslarinda bir kosul olmadigi anlamina gelmez; emin olmak icin
                            danismanina sor.
                        </p>
                    </Alert>
                )
            ) : (
                <>
                    {/* Ana eylem: tek secim, aninda cevap. */}
                    <Card className="mb-4 shadow-sm border-primary-subtle">
                        <Card.Body>
                            <Form.Label htmlFor="failed-course" className="fw-medium">
                                Hangi dersten kaldin?
                            </Form.Label>
                            <Form.Select
                                id="failed-course"
                                size="lg"
                                value={failed}
                                onChange={(e) => setFailed(e.target.value)}
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

                    {impact && (
                        <Alert
                            variant={impact.locked.length >= 5 ? 'danger' : 'warning'}
                            className="mb-4"
                        >
                            <Alert.Heading className="h5 d-flex align-items-center gap-2">
                                <ExclamationTriangleFill />
                                {impact.code} {impact.name} dersinden kalirsan{' '}
                                {impact.locked.length} ders kilitlenir
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
                    )}

                    <Card className="mb-4 shadow-sm">
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
                                            <td>
                                                <strong>{r.code}</strong> {r.name}
                                            </td>
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
                                {levels.map((level, i) => (
                                    <div key={i} className="chain-col">
                                        <div className="small text-uppercase text-body-secondary mb-2">
                                            {i + 1}. kademe
                                        </div>
                                        <div className="d-flex flex-column gap-2">
                                            {level.map((node) => (
                                                <div
                                                    key={node.code}
                                                    className="border rounded p-2 bg-body"
                                                >
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
                </>
            )}
        </>
    )
}

export default Program
