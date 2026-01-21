"use client"

import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ItemCopyButtonProps extends React.ComponentProps<typeof Button> {
    content: string
    variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
}

export function ItemCopyButton({ content, variant = "ghost", className, ...props }: ItemCopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content)
            setCopied(true);
            toast.success("Copied to clipboard")
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy")
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 hover:bg-transparent cursor-pointer focus-visible:ring-0 focus-visible:ring-offset-0", className)}
            onClick={handleCopy}
            title="Copy Item"
            {...props}
        >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
    )
}
