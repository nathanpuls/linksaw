"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Link2, FileText, Clipboard, Home, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SidebarProps {
    className?: string
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentType = searchParams.get('type')

    const items = [
        {
            label: "All Items",
            icon: Home,
            href: "/",
            active: pathname === "/" && !currentType
        },
        {
            label: "Links",
            icon: Link2,
            href: "/?type=link",
            active: currentType === "link"
        },
        {
            label: "Snips",
            icon: FileText,
            href: "/?type=snip",
            active: currentType === "snip"
        },
        {
            label: "Clips",
            icon: Clipboard,
            href: "/?type=clip",
            active: currentType === "clip"
        }
    ]

    return (
        <aside className={cn("flex flex-col h-[calc(100vh-57px)] w-[60px] hover:w-[200px] border-r bg-card transition-all duration-300 z-40 group fixed left-0 top-[57px] overflow-hidden shadow-sm", className)}>

            {/* Navigation */}
            <nav className="flex-1 py-4 flex flex-col gap-2 px-2">
                <TooltipProvider delayDuration={0}>
                    {items.map((item) => (
                        <Tooltip key={item.label}>
                            <TooltipTrigger asChild>
                                <Link href={item.href} className="w-full">
                                    <Button
                                        variant={item.active ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start h-10 px-2 relative transition-all",
                                            item.active && "bg-secondary"
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
                    ))}
                </TooltipProvider>
            </nav>

            {/* Footer Actions */}
            <div className="p-2 border-t mt-auto">
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start h-10 px-2">
                                <Settings className="h-5 w-5 shrink-0" />
                                <span className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                                    Settings
                                </span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="group-hover:hidden">
                            Settings
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </aside>
    )
}
