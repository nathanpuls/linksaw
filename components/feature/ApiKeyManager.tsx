'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ApiKeyManagerProps {
    initialApiKey: string | null
}

export function ApiKeyManager({ initialApiKey }: ApiKeyManagerProps) {
    const [apiKey, setApiKey] = useState(initialApiKey)
    const [isVisible, setIsVisible] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const { toast } = useToast()

    const generateApiKey = async () => {
        setIsGenerating(true)
        try {
            const response = await fetch('/api/key', {
                method: 'POST'
            })

            if (!response.ok) {
                throw new Error('Failed to generate API key')
            }

            const data = await response.json()
            setApiKey(data.apiKey)
            setIsVisible(true)

            toast({
                title: "API Key Generated",
                description: "Your new API key has been created. Make sure to copy it!",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to generate API key. Please try again.",
                variant: "destructive"
            })
        } finally {
            setIsGenerating(false)
        }
    }

    const copyToClipboard = () => {
        if (apiKey) {
            navigator.clipboard.writeText(apiKey)
            toast({
                title: "Copied!",
                description: "API key copied to clipboard",
            })
        }
    }

    const maskedKey = apiKey
        ? `${apiKey.substring(0, 8)}${'•'.repeat(48)}${apiKey.substring(apiKey.length - 8)}`
        : ''

    return (
        <div className="space-y-4">
            {apiKey ? (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            value={isVisible ? apiKey : maskedKey}
                            readOnly
                            className="font-mono text-sm"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsVisible(!isVisible)}
                        >
                            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={copyToClipboard}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        onClick={generateApiKey}
                        disabled={isGenerating}
                        className="w-full"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                        Regenerate API Key
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        ⚠️ Regenerating will invalidate your current API key and break existing integrations.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        You don't have an API key yet. Generate one to use with Apple Shortcuts and other integrations.
                    </p>
                    <Button
                        onClick={generateApiKey}
                        disabled={isGenerating}
                        className="w-full"
                    >
                        {isGenerating ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            'Generate API Key'
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}
