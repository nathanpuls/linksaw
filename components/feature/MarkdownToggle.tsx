'use client'

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateMarkdownPreference } from "@/actions/user"
import { toast } from "sonner"
import { FileText, Eye } from "lucide-react"

interface MarkdownToggleProps {
    initialEnabled: boolean
}

export function MarkdownToggle({ initialEnabled }: MarkdownToggleProps) {
    const [enabled, setEnabled] = useState(initialEnabled)
    const [loading, setLoading] = useState(false)

    const handleToggle = async (checked: boolean) => {
        setLoading(true)
        // Optimistic update
        setEnabled(checked)

        try {
            await updateMarkdownPreference(checked)
            toast.success(checked ? "Markdown rendering enabled" : "Markdown rendering disabled")
        } catch (error: any) {
            // Revert on error
            setEnabled(!checked)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-between space-x-4">
            <div className="flex flex-col space-y-1">
                <div className="flex items-center gap-2">
                    {enabled ? <Eye className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                    <Label htmlFor="markdown-rendering" className="font-medium">
                        {enabled ? "Markdown View" : "Source View"}
                    </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                    {enabled
                        ? "Cards will automatically render Markdown content."
                        : "Show raw text content by default."}
                </span>
            </div>
            <Switch
                id="markdown-rendering"
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={loading}
                className="data-[state=checked]:bg-blue-600"
            />
        </div>
    )
}
