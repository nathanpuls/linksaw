'use client'

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Home, Link2, FileText, Clipboard } from "lucide-react"
import { cn } from "@/lib/utils"

const iconMap = {
    Home,
    Link2,
    FileText,
    Clipboard
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
                            const isActive = pathname === "/" && currentType === item.type
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
