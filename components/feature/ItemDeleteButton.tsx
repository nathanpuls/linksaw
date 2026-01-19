"use client"

import { Button } from "@/components/ui/button"
import { Trash } from "lucide-react"
import { toast } from "sonner"
import { deleteItem, restoreItem } from "@/actions/items"
import { useRouter } from "next/navigation"

interface ItemDeleteButtonProps {
    id: string
    redirectAfterDelete?: boolean
}

export function ItemDeleteButton({ id, redirectAfterDelete = false }: ItemDeleteButtonProps) {
    const router = useRouter()

    const handleDelete = async (e: React.MouseEvent) => {
        // Prevent default if this is inside a link (which it typically is in cards)
        e.preventDefault()
        e.stopPropagation()

        try {
            await deleteItem(id)
            if (redirectAfterDelete) {
                router.push('/')
            }
            toast.success("Item deleted", {
                action: {
                    label: "Undo",
                    onClick: async () => {
                        try {
                            await restoreItem(id)
                            toast.success("Item restored")
                        } catch (err) {
                            toast.error("Failed to restore item")
                        }
                    }
                }
            })
        } catch (err) {
            toast.error("Failed to delete item")
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-full w-9 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer rounded-none"
            onClick={handleDelete}
            title="Delete Item"
        >
            <Trash className="h-[14px] w-[14px]" />
            <span className="sr-only">Delete Item</span>
        </Button>
    )
}
