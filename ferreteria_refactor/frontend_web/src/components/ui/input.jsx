import * as React from "react"

import { cn } from "../../lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
    return (
        <input
            type={type}
            className={cn(
                "flex h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-base transition-all",
                "placeholder:text-slate-400",
                "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none",
                "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
                "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                className
            )}
            ref={ref}
            {...props}
        />
    )
})
Input.displayName = "Input"

export { Input }
