import { createPortal } from 'react-dom';
import { X, BookOpen, ChevronRight, Lightbulb, CheckCircle, Zap } from 'lucide-react';
import { HELP_CONTENT } from './helpContent';

/* ── Botón de ayuda — visible pero no intrusivo ─────────────── */
export const HelpButton = ({ contextKey, onClick }) => {
    const content = HELP_CONTENT[contextKey];
    if (!content) return null;
    return (
        <button onClick={onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs font-semibold transition-all hover:shadow-sm">
            <BookOpen size={13} />
            <span>¿Cómo usar esto?</span>
        </button>
    );
};

/* ── Drawer de ayuda ─────────────────────────────────────────── */
const HelpDrawer = ({ contextKey, onClose }) => {
    const content = HELP_CONTENT[contextKey];
    if (!content) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(15,23,42,0.3)' }}
                onClick={onClose}
            />

            {/* Panel lateral */}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9991,
                width: '100%', maxWidth: '420px',
                background: 'white', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
                display: 'flex', flexDirection: 'column',
                animation: 'slideInRight 0.2s ease-out'
            }}>

                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '20px 20px 16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '28px', lineHeight: 1 }}>{content.icon}</span>
                            <div>
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Guía de uso</p>
                                <h2 style={{ color: 'white', fontWeight: 800, fontSize: '17px', margin: 0, lineHeight: 1.2 }}>{content.title}</h2>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={18} />
                        </button>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{content.description}</p>
                </div>

                {/* Contenido scrollable */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                    {/* Pasos */}
                    {content.steps?.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                <ChevronRight size={14} color="#4f46e5" />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cómo hacerlo paso a paso</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {content.steps.map((step, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
                                            {i + 1}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', margin: '0 0 3px 0' }}>{step.title}</p>
                                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tips */}
                    {content.tips?.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                <Lightbulb size={14} color="#d97706" />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Consejos y buenas prácticas</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {content.tips.map((tip, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                        <span style={{ fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>💡</span>
                                        <p style={{ fontSize: '12px', color: '#78350f', margin: 0, lineHeight: 1.5 }}>{tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Acciones disponibles */}
                    {content.actions?.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                                <Zap size={14} color="#059669" />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acciones disponibles en esta sección</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {content.actions.map((action, i) => (
                                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px' }}>
                                        <CheckCircle size={12} color="#059669" />
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#065f46' }}>{action}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, textAlign: 'center' }}>
                        ¿Necesitas más ayuda? Contacta a soporte desde el menú lateral.
                    </p>
                </div>
            </div>

            <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        </>,
        document.body
    );
};

export default HelpDrawer;
