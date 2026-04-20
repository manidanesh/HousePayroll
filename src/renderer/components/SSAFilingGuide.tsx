/**
 * SSAFilingGuide — In-app step-by-step guide for submitting W-2 Copy A
 * to the Social Security Administration via Business Services Online (BSO).
 *
 * Source: ssa.gov/employer | irs.gov/w2
 *
 * Key facts:
 * - Electronic filing via BSO eliminates the need for a paper Form W-3.
 * - Household employers with < 250 W-2s may use "W-2 Online" directly.
 * - Deadline: January 31 of the following year.
 */
import React, { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Step {
    number: number;
    title: string;
    body: React.ReactNode;
    link?: { label: string; url: string };
    caution?: string;
    tip?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BSO_URL = 'https://www.ssa.gov/employer/';

const STEPS: Step[] = [
    {
        number: 1,
        title: 'Access SSA Business Services Online (BSO)',
        body: (
            <>
                Navigate to the SSA employer portal at <strong>ssa.gov/employer</strong>. BSO is
                the official SSA portal for filing W-2 forms electronically. It is free to use
                for all employers.
            </>
        ),
        link: { label: 'Open SSA Business Services Online →', url: BSO_URL },
        tip: 'Bookmark this page — you will return here every January.',
    },
    {
        number: 2,
        title: 'Register or Log In to BSO',
        body: (
            <>
                If this is your first time, click <strong>"Register"</strong> and create an account
                using your Social Security Number and employer EIN. Returning users click{' '}
                <strong>"Log In"</strong>. You will be prompted for multi-factor authentication.
            </>
        ),
        tip: 'Save your BSO login credentials in a secure location — you will need them every filing season.',
        caution: 'Registration can take up to 2 weeks for mailed PIN verification. Register early — before December.',
    },
    {
        number: 3,
        title: 'Select "W-2 Online" from the BSO Menu',
        body: (
            <>
                After logging in, select <strong>"W-2 Online"</strong> from the employer services
                menu. This is the correct tool for household employers with fewer than 250 W-2s.
                Do <em>not</em> use "AccuWage" unless you have an EFW2-format file prepared by
                payroll software.
            </>
        ),
        tip: 'Household employers with < 250 employees always use W-2 Online, not file upload.',
    },
    {
        number: 4,
        title: 'Enter Your Employer Information',
        body: (
            <>
                Enter your <strong>Employer Identification Number (EIN)</strong>, name, and address
                exactly as they appear on your W-2 PDFs. Select{' '}
                <strong>Kind of Employer: Household</strong> and{' '}
                <strong>Kind of Payer: Household employer (Hshld. emp.)</strong>.
            </>
        ),
        caution: 'Your EIN must match the IRS records exactly. A mismatch will cause rejection.',
    },
    {
        number: 5,
        title: 'Enter Each Employee\'s W-2 Data',
        body: (
            <>
                For each caregiver, enter the values from the W-2 PDF generated in the Tax Center:
                <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Box 1</strong> — Wages, tips, other compensation</li>
                    <li><strong>Box 2</strong> — Federal income tax withheld</li>
                    <li><strong>Box 3</strong> — Social security wages (capped at $168,600)</li>
                    <li><strong>Box 4</strong> — Social security tax withheld</li>
                    <li><strong>Box 5</strong> — Medicare wages and tips</li>
                    <li><strong>Box 6</strong> — Medicare tax withheld</li>
                    <li><strong>Box 14</strong> — CO FAMLI (enter as "CO FAMLI (EE)")</li>
                    <li><strong>Box 15–17</strong> — State: CO, UI Account #, CO income tax</li>
                </ul>
            </>
        ),
        tip: 'Use the "Preview Data" view in the Tax Center to have all box values visible side-by-side while entering data into BSO.',
    },
    {
        number: 6,
        title: 'Review and Submit — No Paper W-3 Needed',
        body: (
            <>
                BSO will show a summary of all W-2 totals — this is the electronic equivalent of
                Form W-3. Review for accuracy, then click <strong>"Submit"</strong>. You will
                receive an <strong>instant confirmation number</strong> — save it. Because you are
                filing electronically, <em>you do not need to mail a paper Form W-3</em>.
            </>
        ),
        tip: 'Print or screenshot your BSO confirmation page. This is your proof of timely filing.',
        caution: 'Keep the confirmation number for at least 4 years — it may be requested during an audit.',
    },
    {
        number: 7,
        title: 'Distribute W-2 Copies to Your Caregiver(s)',
        body: (
            <>
                By <strong>January 31</strong>, provide each caregiver with:
                <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>Copy B</strong> — to attach to their federal tax return</li>
                    <li><strong>Copy C</strong> — for their personal records</li>
                    <li><strong>Copy 2</strong> — to attach to their state (CO) tax return</li>
                </ul>
                You can give these as printed PDFs or securely by email.
            </>
        ),
        caution: 'Failure to provide W-2s to employees by January 31 may result in a penalty of $310 per form.',
    },
];

// ── W-2 Copy Reference ───────────────────────────────────────────────────────

const COPIES = [
    { copy: 'Copy A', recipient: 'Social Security Administration (SSA)', how: 'Via BSO electronic filing ✅', color: '#dc2626' },
    { copy: 'Copy B', recipient: 'Employee — attach to federal return', how: 'Print or email PDF', color: '#7c3aed' },
    { copy: 'Copy C', recipient: 'Employee — personal records',           how: 'Print or email PDF', color: '#0369a1' },
    { copy: 'Copy D', recipient: 'Employer — your records',               how: 'Keep on file 4 years', color: '#047857' },
    { copy: 'Copy 1', recipient: 'State / Local tax department (CO)',      how: 'Colorado: only if CO requires paper filing', color: '#b45309' },
    { copy: 'Copy 2', recipient: 'Employee — attach to CO tax return',    how: 'Print or email PDF', color: '#b45309' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const SSAFilingGuide: React.FC = () => {
    const [activeStep, setActiveStep] = useState<number | null>(null);
    const [showCopies, setShowCopies] = useState(false);

    const toggle = (n: number) => setActiveStep(prev => prev === n ? null : n);

    // ── Styles ────────────────────────────────────────────────────────────────
    const container: React.CSSProperties = { maxWidth: 760, margin: '0 auto' };

    const stepCard = (n: number): React.CSSProperties => ({
        border: `1px solid ${activeStep === n ? 'var(--primary)' : 'var(--border-light)'}`,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        boxShadow: activeStep === n ? '0 0 0 2px rgba(var(--primary-rgb), 0.15)' : 'none',
    });

    const stepHeader = (n: number): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        background: activeStep === n ? 'rgba(var(--primary-rgb), 0.07)' : 'var(--bg-card)',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.15s',
    });

    const badge = (n: number): React.CSSProperties => ({
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 13,
        background: activeStep === n ? 'var(--primary)' : 'var(--bg-app)',
        color: activeStep === n ? '#fff' : 'var(--primary)',
        border: `2px solid ${activeStep === n ? 'var(--primary)' : 'var(--border-light)'}`,
    });

    const body: React.CSSProperties = {
        padding: '0 18px 16px 62px',
        background: 'var(--bg-card)',
        fontSize: 13.5,
        lineHeight: 1.65,
        color: 'var(--text-main)',
    };

    const callout = (type: 'tip' | 'caution'): React.CSSProperties => ({
        marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12,
        background: type === 'tip' ? '#f0fdf4' : '#fff8e1',
        border: `1px solid ${type === 'tip' ? '#86efac' : '#fcd34d'}`,
        color: type === 'tip' ? '#166534' : '#92400e',
    });

    return (
        <div style={container}>

            {/* ── Headline ──────────────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(135deg, #1a3a6c 0%, #1e40af 100%)',
                borderRadius: 14, padding: '20px 24px', marginBottom: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <div>
                    <div style={{ color: '#93c5fd', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                        Official Electronic Filing
                    </div>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
                        Submitting W-2 via SSA BSO
                    </div>
                    <div style={{ color: '#bfdbfe', fontSize: 12 }}>
                        Business Services Online · ssa.gov/employer · Free · No paper W-3 required
                    </div>
                </div>
                <div style={{
                    background: 'rgba(255,255,255,0.1)', borderRadius: 10,
                    padding: '10px 16px', textAlign: 'center', flexShrink: 0,
                }}>
                    <div style={{ color: '#fbbf24', fontSize: 22, fontWeight: 900 }}>Jan 31</div>
                    <div style={{ color: '#e0f2fe', fontSize: 10 }}>Annual Deadline</div>
                </div>
            </div>

            {/* ── Key facts bar ─────────────────────────────────────────── */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20
            }}>
                {[
                    { icon: '🆓', label: 'Free to use', sub: 'No fees via BSO' },
                    { icon: '📄', label: 'No paper W-3', sub: 'BSO generates the equivalent' },
                    { icon: '✅', label: 'Instant confirmation', sub: 'Proof of filing' },
                ].map(({ icon, label, sub }) => (
                    <div key={label} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                        borderRadius: 10, padding: '12px 14px', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Steps (accordion) ─────────────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                    Step-by-Step Filing Guide
                </div>
                {STEPS.map(step => (
                    <div key={step.number} style={stepCard(step.number)}>
                        <div style={stepHeader(step.number)} onClick={() => toggle(step.number)}>
                            <div style={badge(step.number)}>{step.number}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{step.title}</div>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700 }}>
                                {activeStep === step.number ? '−' : '+'}
                            </div>
                        </div>

                        {activeStep === step.number && (
                            <div style={body}>
                                <div style={{ paddingTop: 2 }}>{step.body}</div>

                                {step.tip && (
                                    <div style={callout('tip')}>
                                        💡 <strong>Tip:</strong> {step.tip}
                                    </div>
                                )}
                                {step.caution && (
                                    <div style={callout('caution')}>
                                        ⚠️ <strong>Important:</strong> {step.caution}
                                    </div>
                                )}
                                {step.link && (
                                    <div style={{ marginTop: 14 }}>
                                        <a
                                            href={step.link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => {
                                                e.preventDefault();
                                                window.electronAPI.invoke('shell:openExternal', step.link!.url);
                                            }}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '8px 16px', borderRadius: 8,
                                                background: 'var(--primary)', color: '#fff',
                                                fontWeight: 600, fontSize: 13, textDecoration: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {step.link.label}
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── W-2 Copy Reference ────────────────────────────────────── */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                borderRadius: 12, overflow: 'hidden', marginBottom: 20,
            }}>
                <div
                    style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 18px', cursor: 'pointer',
                    }}
                    onClick={() => setShowCopies(c => !c)}
                >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>📋 W-2 Copy Distribution Reference</div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{showCopies ? '−' : '+'}</span>
                </div>
                {showCopies && (
                    <div style={{ padding: '0 18px 16px' }}>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0 }}>
                            The W-2 has 6 copies. Each must go to the right recipient by January 31.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {COPIES.map(({ copy, recipient, how, color }) => (
                                <div key={copy} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '10px 14px', borderRadius: 8,
                                    background: 'var(--bg-app)', borderLeft: `4px solid ${color}`
                                }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, minWidth: 64, color }}>{copy}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{recipient}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{how}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Footer reminder ───────────────────────────────────────── */}
            <div style={{
                background: 'rgba(var(--primary-rgb), 0.06)',
                border: '1px solid rgba(var(--primary-rgb), 0.2)',
                borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)',
            }}>
                ⚖️ <strong>Legal reminder:</strong> Filing W-2 Copy A electronically via BSO by January 31
                satisfies your SSA obligation. You still need to file <strong>Schedule H</strong> with your
                personal Form 1040 by April 15, and <strong>DR 1093</strong> with the Colorado DOR by January 31.
            </div>
        </div>
    );
};

export default SSAFilingGuide;
