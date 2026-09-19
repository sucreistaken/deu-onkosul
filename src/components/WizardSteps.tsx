/**
 * Sihirbazin nerede oldugunu gosteren ust serit.
 *
 * Kullanici kac adim kaldigini gorsun diye var; "ne olacak ne bitecek"
 * sorusunun cevabi bu.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { CheckCircleFill } from 'react-bootstrap-icons'

export interface Step {
    label: string
    /** Bu adima donulebiliyorsa adres; tamamlanmamis adimlarda undefined. */
    to?: string
}

const WizardSteps: React.FC<{ steps: Step[]; current: number }> = ({ steps, current }) => (
    <ol className="list-unstyled d-flex flex-wrap align-items-center gap-2 gap-sm-3 mb-4 small">
        {steps.map((s, i) => {
            const done = i < current
            const active = i === current
            const body = (
                <span
                    className={
                        active
                            ? 'fw-semibold text-primary'
                            : done
                                ? 'text-body-secondary'
                                : 'text-body-tertiary'
                    }
                >
                    {done ? (
                        <CheckCircleFill className="me-1" size={13} aria-hidden />
                    ) : (
                        <span className="me-1">{i + 1}.</span>
                    )}
                    {s.label}
                </span>
            )
            return (
                <li key={s.label} className="d-flex align-items-center gap-2 gap-sm-3">
                    {done && s.to ? <Link to={s.to} className="text-decoration-none">{body}</Link> : body}
                    {i < steps.length - 1 && (
                        <span className="text-body-tertiary" aria-hidden>&rsaquo;</span>
                    )}
                </li>
            )
        })}
    </ol>
)

export default WizardSteps
