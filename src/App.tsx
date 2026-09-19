/**
 * Uygulama kabugu ve rotalar.
 *
 * Gorunum forumla (NodeBB Harmony) ayni: Bootstrap 5, Inter, #0d6efd.
 * Kullanici verisi tutulmaz, giris yoktur, hicbir sey sunucuya gitmez.
 */

import React from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Container, Nav, Navbar } from 'react-bootstrap'
import { Diagram3Fill } from 'react-bootstrap-icons'
import Home from './pages/Home'
import Program from './pages/Program'

const FORUM_URL = 'https://dokuzeylul.net'

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
        <Navbar expand="sm" className="bg-body border-bottom">
            <Container>
                <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 fw-semibold">
                    <Diagram3Fill className="text-primary" size={20} />
                    DEU On Kosul
                </Navbar.Brand>
                <Nav>
                    <Nav.Link href={FORUM_URL}>DEU Forum</Nav.Link>
                </Nav>
            </Container>
        </Navbar>

        <main className="flex-grow-1 py-4">
            <Container>{children}</Container>
        </main>

        <footer className="border-top py-3 bg-body">
            <Container>
                <p className="text-body-secondary small mb-0">
                    Veriler DEU Ders Katalogu / Bilgi Paketi'nden alinmistir. Resmi bir DEU
                    uygulamasi degildir. Kesin bilgi icin danismaniniza ve kayit ekranina
                    bakin.{' '}
                    <a href={FORUM_URL}>DEU Forum</a>
                </p>
            </Container>
        </footer>
    </div>
)

const App: React.FC = () => (
    <BrowserRouter>
        <Shell>
            <Routes>
                <Route path="/" element={<Home />} />
                {/* Sihirbazin dort adimi; her adim kendi adresinde. */}
                <Route path="/program/:id" element={<Program />} />
                <Route path="/program/:id/yil" element={<Program />} />
                <Route path="/program/:id/yil/:year/ders" element={<Program />} />
                <Route path="/program/:id/yil/:year/ders/:code" element={<Program />} />
            </Routes>
        </Shell>
    </BrowserRouter>
)

export default App
