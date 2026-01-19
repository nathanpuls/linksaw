'use client'

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { claimUsername } from "@/actions/user"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function UsernameModal({ initialIsOpen = false }: { initialIsOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(initialIsOpen)
    const [username, setUsername] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await claimUsername(username)
            toast.success("Username claimed!")
            setIsOpen(false)
            router.refresh()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => {
                // Prevent closing if we are strictly enforcing username
                // If initialIsOpen is true (meaning no username), we might want to block close?
                // For now allow close, but maybe nag?
                if (initialIsOpen) e.preventDefault();
            }}>
                <DialogHeader>
                    <DialogTitle>Claim your handle</DialogTitle>
                    <DialogDescription>
                        Choose a unique username to create your personal Linksaw space.
                        Your items will be at <code>linksaw.com/@username/item</code>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-lg">@</span>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username"
                            className="font-mono"
                            minLength={3}
                            maxLength={30}
                            pattern="[a-zA-Z0-9_]+"
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Claiming..." : "Claim Username"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
