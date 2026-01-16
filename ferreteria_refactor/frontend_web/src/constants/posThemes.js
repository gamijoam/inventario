export const POS_THEMES = [
    {
        id: 'default',
        name: 'Clásico (Blanco)',
        app_bg: 'bg-slate-100',
        left_bg: 'bg-white',
        right_bg: 'bg-slate-50/80 backdrop-blur-md',
        text_color: 'text-slate-800',
        border_color: 'border-slate-200',
        hover_bg: 'hover:bg-slate-50'
    },
    {
        id: 'dark',
        name: 'Modo Oscuro',
        app_bg: 'bg-slate-950',
        left_bg: 'bg-slate-900',
        right_bg: 'bg-slate-800/80 backdrop-blur-md',
        text_color: 'text-slate-100',
        border_color: 'border-slate-700',
        hover_bg: 'hover:bg-slate-800'
    },
    {
        id: 'ocean',
        name: 'Océano',
        app_bg: 'bg-gradient-to-br from-blue-100 via-indigo-100 to-slate-200',
        left_bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
        right_bg: 'bg-white/60 backdrop-blur-xl',
        text_color: 'text-indigo-900',
        border_color: 'border-indigo-100',
        hover_bg: 'hover:bg-white/50'
    },
    {
        id: 'forest',
        name: 'Bosque',
        app_bg: 'bg-gradient-to-br from-emerald-100 via-teal-100 to-slate-200',
        left_bg: 'bg-emerald-50',
        right_bg: 'bg-emerald-50/50 backdrop-blur-md',
        text_color: 'text-emerald-900',
        border_color: 'border-emerald-100',
        hover_bg: 'hover:bg-emerald-100/50'
    },
    {
        id: 'sunset',
        name: 'Atardecer',
        app_bg: 'bg-gradient-to-br from-orange-100 via-rose-100 to-slate-200',
        left_bg: 'bg-gradient-to-br from-orange-50 to-rose-50',
        right_bg: 'bg-rose-50/50 backdrop-blur-md',
        text_color: 'text-rose-900',
        border_color: 'border-rose-100',
        hover_bg: 'hover:bg-rose-100'
    },
    {
        id: 'purple',
        name: 'Amatista',
        app_bg: 'bg-gradient-to-br from-purple-100 via-fuchsia-100 to-slate-200',
        left_bg: 'bg-purple-50',
        right_bg: 'bg-purple-50/50 backdrop-blur-md',
        text_color: 'text-purple-900',
        border_color: 'border-purple-100',
        hover_bg: 'hover:bg-purple-100'
    },
    {
        id: 'midnight',
        name: 'Medianoche',
        app_bg: 'bg-slate-950',
        left_bg: 'bg-slate-900',
        right_bg: 'bg-black/40 backdrop-blur-xl',
        text_color: 'text-slate-300',
        border_color: 'border-slate-800',
        hover_bg: 'hover:bg-slate-800'
    },
    {
        id: 'coffee',
        name: 'Café',
        app_bg: 'bg-[#f5f5f4]', // Stone 100
        left_bg: 'bg-[#fafaf9]', // Stone 50
        right_bg: 'bg-[#e7e5e4]/60 backdrop-blur-md', // Stone 200
        text_color: 'text-stone-800',
        border_color: 'border-stone-200',
        hover_bg: 'hover:bg-stone-100'
    },
    {
        id: 'sky',
        name: 'Cielo',
        app_bg: 'bg-gradient-to-br from-sky-100 via-blue-100 to-white',
        left_bg: 'bg-sky-50',
        right_bg: 'bg-sky-200/40 backdrop-blur-md',
        text_color: 'text-sky-900',
        border_color: 'border-sky-100',
        hover_bg: 'hover:bg-sky-100'
    },
    {
        id: 'cherry',
        name: 'Cereza',
        app_bg: 'bg-gradient-to-br from-red-50 via-rose-100 to-pink-50',
        left_bg: 'bg-rose-50',
        right_bg: 'bg-white/60 backdrop-blur-md',
        text_color: 'text-rose-900',
        border_color: 'border-rose-200',
        hover_bg: 'hover:bg-rose-100'
    },
    {
        id: 'steel',
        name: 'Acero',
        app_bg: 'bg-gradient-to-br from-gray-200 via-slate-200 to-zinc-200',
        left_bg: 'bg-gray-50',
        right_bg: 'bg-white/40 backdrop-blur-xl',
        text_color: 'text-gray-800',
        border_color: 'border-gray-200',
        hover_bg: 'hover:bg-gray-200'
    }
];

export const DEFAULT_THEME = POS_THEMES[0];
