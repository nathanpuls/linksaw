'use client'

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { claimUsername } from "@/actions/user"
import { signOut } from "@/actions/auth"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { User, LogOut, AlertTriangle } from "lucide-react"
import Image from "next/image"

interface UserProfileMenuProps {
    user: {
        id: string
        email?: string
        user_metadata?: {
            avatar_url?: string
            full_name?: string
        }
    }
    profile: {
        username?: string
        avatar_url?: string
        full_name?: string
    } | null
}

export function UserProfileMenu({ user, profile }: UserProfileMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isEditingUsername, setIsEditingUsername] = useState(false)
    const [newUsername, setNewUsername] = useState(profile?.username || "")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url
    const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || "User"
    const currentUsername = profile?.username || ""

    const handleUsernameChange = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newUsername === currentUsername) {
            setIsEditingUsername(false)
            return
        }

        setLoading(true)
        try {
            await claimUsername(newUsername)
            toast.success("Username updated!")
            setIsEditingUsername(false)
            router.refresh()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSignOut = async () => {
        await signOut()
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-center group-hover:justify-start p-2 hover:bg-accent rounded-md transition-all"
            >
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt={displayName}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                </div>
                <span className="opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-[150px] group-hover:ml-3 transition-all duration-300 whitespace-nowrap overflow-hidden text-sm font-medium">
                    {displayName}
                </span>
            </button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Profile</DialogTitle>
                        <DialogDescription>
                            Manage your account settings
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Profile Picture & Name */}
                        <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted">
                                {avatarUrl ? (
                                    <Image
                                        src={avatarUrl}
                                        alt={displayName}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="font-medium">{displayName}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>

                        {/* Username Section */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Username</label>
                            {!isEditingUsername ? (
                                <div className="flex items-center justify-between">
                                    <code className="text-sm bg-muted px-2 py-1 rounded">@{currentUsername}</code>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setIsEditingUsername(true)
                                            setNewUsername(currentUsername)
                                        }}
                                    >
                                        Edit
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleUsernameChange} className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground font-mono">@</span>
                                        <Input
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            placeholder="username"
                                            className="font-mono"
                                            minLength={3}
                                            maxLength={30}
                                            pattern="[a-zA-Z0-9_]+"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                            Changing your username will break existing links to your items (linksaw.com/@{currentUsername}/item)
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="submit" size="sm" disabled={loading}>
                                            {loading ? "Saving..." : "Save"}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsEditingUsername(false)}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button
                            variant="ghost"
                            onClick={handleSignOut}
                            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
