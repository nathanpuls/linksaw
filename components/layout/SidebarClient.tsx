'use client'

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Home, Link2, FileText, Clipboard, Settings, User } from "lucide-react"

interface SidebarItem {
    label: string
    icon: string
    href: string
    type: string | null
    shortcut?: string
}

const HomePlate = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
)

const TextMinimal = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="15" y2="12" />
        <line x1="4" y1="17" x2="18" y2="17" />
    </svg>
)

const iconMap = {
    Home: HomePlate,
    Link2,
    FileText: TextMinimal,
    TextMinimal: TextMinimal,
    Clipboard,
    Settings,
    User
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
                    const isActive = item.href.startsWith("/?")
                        ? (pathname === "/" && currentType === item.type)
                        : item.href === "/"
                            ? (pathname === "/" && !currentType)
                            : pathname === item.href;
                    const IconComponent = iconMap[item.icon as keyof typeof iconMap]

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
                                        <IconComponent className="h-5 w-5 shrink-0" />
                                        <span className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                                            {item.label}
                                        </span>
                                    </Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="flex items-center gap-2">
                                <span>{item.label}</span>
                                {item.shortcut && (
                                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                        <span className="text-xs">{item.shortcut}</span>
                                    </kbd>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </TooltipProvider>
        </nav>
    )
}
