import * as React from "react"

import { cn } from "../../lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
    return (
        <textarea
            className={cn(
                "flex min-h-[80px] w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base transition-all",
                "placeholder:text-slate-400",
                "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none",
                "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
                "resize-none",
                className
            )}
            ref={ref}
            {...props}
        />
    )
})
Textarea.displayName = "Textarea"

export { Textarea }
