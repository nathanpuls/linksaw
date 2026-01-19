import Link from "next/link"
import { cn } from "@/lib/utils"
import { Link2, FileText, Clipboard, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/utils/supabase/server"
import { UserProfileMenu } from "@/components/feature/UserProfileMenu"
import { SidebarClient } from "./SidebarClient"

interface SidebarProps {
    className?: string
}

export async function Sidebar({ className }: SidebarProps) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let profile = null
    if (user) {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
        profile = data
    }

    const items = [
        {
            label: "All Items",
            icon: Home,
            href: "/",
            type: null
        },
        {
            label: "Links",
            icon: Link2,
            href: "/?type=link",
            type: "link"
        },
        {
            label: "Snips",
            icon: FileText,
            href: "/?type=snip",
            type: "snip"
        },
        {
            label: "Clips",
            icon: Clipboard,
            href: "/?type=clip",
            type: "clip"
        }
    ]

    return (
        <aside className={cn("flex flex-col h-[calc(100vh-57px)] w-[60px] hover:w-[200px] border-r bg-card transition-all duration-300 z-40 group fixed left-0 top-[57px] overflow-hidden shadow-sm", className)}>
            <SidebarClient items={items} />

            {/* User Profile Menu at Bottom */}
            {user && (
                <div className="p-2 border-t mt-auto">
                    <UserProfileMenu user={user} profile={profile} />
                </div>
            )}
        </aside>
    )
}
