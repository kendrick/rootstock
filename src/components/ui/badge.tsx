import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { FOCUS_RING } from "@/lib/focus"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
    FOCUS_RING
  ),
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Provenance, not a primary action. Amber is the one hue in the palette
        // and it means the line is cited; the wash keeps the pill quieter than
        // the rule name it sits beside.
        evidence:
          "border-evidence/40 bg-evidence/10 text-evidence hover:bg-evidence/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
