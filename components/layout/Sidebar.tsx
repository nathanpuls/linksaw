import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/utils/supabase/server"
import { UserProfileMenu } from "@/components/feature/UserProfileMenu"
import { SidebarClient } from "./SidebarClient"
import { navItems } from "@/lib/nav-items"

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

    return (
        <aside className={cn("flex flex-col h-[calc(100vh-57px)] w-[60px] hover:w-[200px] border-r bg-card transition-all duration-300 z-40 group fixed left-0 top-[57px] overflow-hidden shadow-sm", className)}>
            <SidebarClient items={navItems} />

            {/* User Profile Menu at Bottom */}
            {user && (
                <div className="p-2 border-t mt-auto">
                    <UserProfileMenu user={user} profile={profile} />
                </div>
            )}
        </aside>
    )
}
