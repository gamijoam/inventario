import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95",
                destructive:
                    "bg-rose-600 text-white shadow-lg shadow-rose-200 hover:bg-rose-700 hover:-translate-y-0.5 active:scale-95",
                outline:
                    "border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:scale-95",
                ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900",
                link: "text-indigo-600 underline-offset-4 hover:underline",
            },
            size: {
                default: "h-11 px-6 py-2.5 text-base md:h-10 md:px-4 md:py-2 md:text-sm",
                sm: "h-10 px-4 text-sm md:h-9 md:px-3 md:text-xs",
                lg: "h-14 px-8 text-lg md:h-12 md:px-8 md:text-base",
                icon: "h-11 w-11 md:h-10 md:w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
        <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props}
        />
    )
})
Button.displayName = "Button"

export { Button, buttonVariants }
