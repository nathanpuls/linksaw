'use client'

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LayoutGrid, List } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

export function ViewToggle() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const view = searchParams.get('view') || 'grid'

    const handleViewChange = (newView: string) => {
        if (!newView) return
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', newView)
        router.replace(`?${params.toString()}`, { scroll: false })
    }

    return (
        <ToggleGroup type="single" value={view} onValueChange={handleViewChange}>
            <ToggleGroupItem value="grid" aria-label="Grid view" className="h-9 w-9 p-0">
                <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="h-9 w-9 p-0">
                <List className="h-4 w-4" />
            </ToggleGroupItem>
        </ToggleGroup>
    )
}
