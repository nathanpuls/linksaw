import { Sidebar } from "./Sidebar"
import { MobileNav } from "./MobileNav"
import { navItems } from "@/lib/nav-items"
import { SearchBar } from "@/components/feature/SearchBar"
import { NewItemButton } from "@/components/feature/NewItemButton"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface ShellProps {
    children: React.ReactNode
    profile?: any
    isReadOnly?: boolean
    pageTitle?: string
    showSearch?: boolean
    showActions?: boolean
}

export async function Shell({
    children,
    profile,
    isReadOnly = false,
    pageTitle,
    showSearch = true,
    showActions = true
}: ShellProps) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Unified Header */}
            <header className="fixed top-0 left-0 right-0 h-[57px] border-b bg-background/80 backdrop-blur-md z-50">
                <div className={cn(
                    "h-full flex items-center px-4 justify-between gap-4",
                    isReadOnly && "container mx-auto"
                )}>
                    {/* Left Side: Branding & Context */}
                    <div className="flex items-center gap-2 shrink-0">
                        {!isReadOnly && <MobileNav items={navItems} />}
                        <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden">
                                <Image
                                    src="/logo.png"
                                    alt="Linksaw Logo"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <span className="font-bold text-lg hidden sm:inline-block">
                                {profile?.full_name || ''}
                            </span>
                        </Link>
                        {profile?.username && (
                            <Link
                                href={`/${profile.username}`}
                                className={cn(
                                    "text-sm font-normal text-muted-foreground hidden sm:inline-block ml-1 transition-colors",
                                    !isReadOnly ? "hover:text-foreground" : "cursor-default"
                                )}
                                {...(!isReadOnly ? { target: "_blank" } : {})}
                            >
                                @{profile.username}
                            </Link>
                        )}

                        {/* Breadcrumb Title (Dashboard only) */}
                        {!isReadOnly && pageTitle && (
                            <>
                                <div className="h-4 w-[1px] bg-border mx-2 hidden md:block" />
                                <h1 className="text-sm font-medium text-muted-foreground hidden md:block capitalize">
                                    {pageTitle}
                                </h1>
                            </>
                        )}
                    </div>

                    {/* Right Side: Dashboard Actions */}
                    {!isReadOnly && (
                        <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end min-w-0">
                            {showSearch && (
                                <div className="w-full max-w-[200px] md:max-w-xs">
                                    <SearchBar />
                                </div>
                            )}
                            {showActions && (
                                <div className="hidden md:block">
                                    <NewItemButton />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Layout Body */}
            <div className="pt-[57px] flex min-h-screen">
                {/* Sidebar only for dashboard users */}
                {!isReadOnly && <Sidebar className="hidden md:flex" />}

                <main className={cn(
                    "flex-1 flex flex-col transition-all",
                    !isReadOnly ? "md:pl-[60px]" : "w-full"
                )}>
                    <div className={cn(
                        "flex-1 w-full",
                        !isReadOnly ? "container mx-auto px-4 py-6" : "container mx-auto px-4 py-8"
                    )}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
