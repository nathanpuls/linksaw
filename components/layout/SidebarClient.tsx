'use client'

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { LucideIcon } from "lucide-react"

interface SidebarItem {
    label: string
    icon: LucideIcon
    href: string
    type: string | null
}

interface SidebarClientProps {
    items: SidebarItem[]
}

export function SidebarClient({ items }: SidebarClientProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentType = searchParams.get('type')

    return (
        <nav className="flex-1 py-4 flex flex-col gap-2 px-2">
            <TooltipProvider delayDuration={0}>
                {items.map((item) => {
                    const isActive = pathname === "/" && currentType === item.type

                    return (
                        <Tooltip key={item.label}>
                            <TooltipTrigger asChild>
                                <Link href={item.href} className="w-full">
                                    <Button
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start h-10 px-2 relative transition-all",
                                            isActive && "bg-secondary"
                                        )}
                                    >
                                        <item.icon className="h-5 w-5 shrink-0" />
                                        <span className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                                            {item.label}
                                        </span>
                                    </Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="group-hover:hidden">
                                {item.label}
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </TooltipProvider>
        </nav>
    )
}
