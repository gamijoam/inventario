import { useEffect, useState } from 'react';
import { X, Sparkles, ChevronRight } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

// ─── Content parser ────────────────────────────────────────────────────────────
// Each line of the announcement content can follow this format:
//   "emoji Title | short description"
//
// Example content:
//   🔧 Impresión de órdenes | El ticket se imprime al crear una recepción técnica
//   📱 IMEI en recibos POS | El número de serie aparece en el recibo del cliente
//   📊 Tasa BCV automática | Consulta la tasa oficial con un solo clic
//
// Lines that don't follow this format are shown as a plain paragraph.
function parseFeatures(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const features = lines
        .map(line => {
            const sepIdx = line.indexOf(' | ');
            if (sepIdx === -1) return null;
            const left  = line.slice(0, sepIdx).trim();   // "🔧 Impresión de órdenes"
            const desc  = line.slice(sepIdx + 3).trim();  // "El ticket se imprime..."

            // Extract leading emoji (one or more unicode emoji chars before the title text)
            const emojiMatch = left.match(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]+)\s*/u);
            const icon  = emojiMatch ? emojiMatch[1] : '✦';
            const title = emojiMatch ? left.slice(emojiMatch[0].length) : left;
            return { icon, title, desc };
        })
        .filter(Boolean);

    return features.length > 0 ? { type: 'features', items: features } : { type: 'plain', text: content };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function AnnouncementModal() {
    const { announcements, dismissAnnouncement, isAnnouncementDismissed } = useNotifications();
    const [visible, setVisible]   = useState(false);
    const [closing, setClosing]   = useState(false);
    const [current, setCurrent]   = useState(null);
    const [parsed,  setParsed]    = useState(null);

    // Pick the first announcement not yet dismissed by this user
    useEffect(() => {
        if (!announcements || announcements.length === 0) return;

        const pending = announcements.find(
            a => !isAnnouncementDismissed(a.id)
        );

        if (pending) {
            setCurrent(pending);
            setParsed(parseFeatures(pending.content));
            // Small delay so the page settles before showing the modal
            const t = setTimeout(() => setVisible(true), 600);
            return () => clearTimeout(t);
        }
    }, [announcements, isAnnouncementDismissed]);

    const handleClose = () => {
        // Mark as seen IMMEDIATELY (sync) before the animation — prevents re-show
        // if the tab closes or navigates during the 250ms closing animation.
        if (current) {
            dismissAnnouncement(current.id);
        }
        setClosing(true);
        setTimeout(() => {
            setVisible(false);
            setClosing(false);
            setCurrent(null);
            setParsed(null);
        }, 250);
    };

    if (!visible || !current || !parsed) return null;

    return (
        /* ── Backdrop ── */
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center p-4
                        bg-slate-900/60 backdrop-blur-sm
                        ${closing ? 'animate-out fade-out duration-250' : 'animate-in fade-in duration-300'}`}
            onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
            {/* ── Card ── */}
            <div
                className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden
                            ${closing ? 'animate-out zoom-out-95 duration-250' : 'animate-in zoom-in-95 duration-300'}`}
            >
                {/* ── Header gradient ── */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-6 pt-6 pb-8">
                    {/* decorative circles */}
                    <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-white/5" />
                    <div className="absolute top-6 -right-8 w-20 h-20 rounded-full bg-white/5" />

                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/15 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                            <Sparkles size={20} className="text-yellow-300" />
                        </div>
                        <div>
                            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">
                                Actualización
                            </p>
                            <h2 className="text-white font-bold text-lg leading-tight">
                                {current.title}
                            </h2>
                        </div>
                        {current.version_tag && (
                            <span className="ml-auto shrink-0 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                {current.version_tag}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="px-6 py-5 -mt-3 bg-white rounded-t-2xl relative">
                    {parsed.type === 'features' ? (
                        <ul className="space-y-3">
                            {parsed.items.map((f, i) => (
                                <li key={i} className="flex items-start gap-3 group">
                                    {/* icon bubble */}
                                    <span className="shrink-0 w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-lg mt-0.5 group-hover:bg-indigo-100 transition-colors">
                                        {f.icon}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                                            {f.title}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                            {f.desc}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                            {parsed.text}
                        </p>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 pb-6 bg-white">
                    <button
                        onClick={handleClose}
                        className="w-full flex items-center justify-center gap-2
                                   bg-gradient-to-r from-indigo-600 to-violet-600
                                   hover:from-indigo-700 hover:to-violet-700
                                   text-white font-semibold text-sm py-3 rounded-xl
                                   shadow-lg shadow-indigo-200 hover:shadow-indigo-300
                                   transition-all duration-200 active:scale-[0.98]"
                    >
                        ¡Entendido, a trabajar!
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
