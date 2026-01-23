'use client'

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Home, Link2, FileText, Clipboard, Settings, User } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface MobileNavProps {
    items: Array<{
        label: string
        icon: string
        href: string
        type: string | null
    }>
}

export function MobileNav({ items }: MobileNavProps) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentType = searchParams.get('type')

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
                <div className="flex flex-col h-full py-6">
                    <div className="px-6 mb-6">
                        <h2 className="text-lg font-semibold">Navigation</h2>
                    </div>
                    <nav className="flex-1 px-3 space-y-1">
                        {items.map((item) => {
                            const isActive = item.href.startsWith("/?")
                                ? (pathname === "/" && currentType === item.type)
                                : item.href === "/"
                                    ? (pathname === "/" && !currentType)
                                    : pathname === item.href;
                            const IconComponent = iconMap[item.icon as keyof typeof iconMap]

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                                        isActive
                                            ? "bg-secondary text-secondary-foreground"
                                            : "hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    <IconComponent className="h-5 w-5" />
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </SheetContent>
        </Sheet>
    )
}
