'use client'

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateProfileVisibility } from "@/actions/user"
import { toast } from "sonner"
import { Shield, Globe } from "lucide-react"

interface VisibilityToggleProps {
    initialIsPublic: boolean
}

export function VisibilityToggle({ initialIsPublic }: VisibilityToggleProps) {
    const [isPublic, setIsPublic] = useState(initialIsPublic)
    const [loading, setLoading] = useState(false)

    const handleToggle = async (checked: boolean) => {
        setLoading(true)
        // Optimistic update
        setIsPublic(checked)

        try {
            await updateProfileVisibility(checked)
            toast.success(checked ? "Profile is now public" : "Profile is now private")
        } catch (error: any) {
            // Revert on error
            setIsPublic(!checked)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-between space-x-4">
            <div className="flex flex-col space-y-1">
                <div className="flex items-center gap-2">
                    {isPublic ? <Globe className="h-4 w-4 text-blue-500" /> : <Shield className="h-4 w-4 text-green-500" />}
                    <Label htmlFor="public-profile" className="font-medium">
                        {isPublic ? "Public Profile" : "Private Profile"}
                    </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                    {isPublic
                        ? "Your saved items are visible to anyone with the link."
                        : "Only you can see your saved items."}
                </span>
            </div>
            <Switch
                id="public-profile"
                checked={isPublic}
                onCheckedChange={handleToggle}
                disabled={loading}
                className="data-[state=checked]:bg-blue-600"
            />
        </div>
    )
}
