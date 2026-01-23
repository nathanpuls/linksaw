'use client'

import { useState, useTransition, useEffect } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers'
import { ItemCard } from './ItemCard'
import { updateItemOrder, deleteItems } from '@/actions/items'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ItemEditor } from './ItemEditor'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

interface Item {
    id: string
    title: string
    content: string
    language?: string
    slug?: string
    alias?: string | null
    order_index: number
    type?: string
}

interface ItemListProps {
    initialItems: any[]
    username?: string
    displayName?: string
    isReadOnly?: boolean
}

export function ItemList({ initialItems, username, displayName, isReadOnly = false }: ItemListProps) {
    const [items, setItems] = useState<Item[]>(initialItems)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)
    const [activeItem, setActiveItem] = useState<Item | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    const router = useRouter()
    const searchParams = useSearchParams()
    const isCreating = searchParams.get('new') === 'true'
    const [isCreatingOpen, setIsCreatingOpen] = useState(false)

    useEffect(() => {
        setIsCreatingOpen(isCreating)
    }, [isCreating])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        setItems(initialItems)
    }, [initialItems])

    const sensors = useSensors(
        useSensor(PointerSensor, { // Requires pointer to drag
            activationConstraint: {
                // If read only, make distance huge to effectively disable. 
                // Alternatively, just don't pass sensors if read only but hook rules.
                distance: isReadOnly ? 1000 : 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleClose = () => {
        if (activeItem) {
            setActiveItem(null)
        } else if (isCreatingOpen) {
            setIsCreatingOpen(false)
            router.push('/app')
        }
    }

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        )
    }

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return

        const idsToDelete = [...selectedIds]
        const previousItems = [...items]

        setSelectedIds([])
        setItems(prev => prev.filter(item => !idsToDelete.includes(item.id)))

        startTransition(async () => {
            try {
                await deleteItems(idsToDelete)
                toast.success(`Deleted ${idsToDelete.length} items`)
                router.refresh()
            } catch (e: any) {
                toast.error("Failed to delete items")
                setItems(previousItems)
                setSelectedIds(idsToDelete)
            }
        })
    }

    const handleSingleDelete = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id))
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        if (isReadOnly) return

        const { active, over } = event
        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((s) => s.id === active.id)
            const newIndex = items.findIndex((s) => s.id === over.id)

            const newOrderedItems = arrayMove(items, oldIndex, newIndex)
            setItems(newOrderedItems)

            startTransition(async () => {
                try {
                    await updateItemOrder(newOrderedItems.map(s => s.id))
                } catch (e) {
                    console.error("Order sync error:", e)
                }
            })
        }
    }

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {items.map((item) => (
                    <ItemCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        content={item.content}
                        language={item.language}
                        slug={item.slug}
                        alias={item.alias}
                        isReadOnly={isReadOnly}
                        username={username}
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="relative pb-24">
            {!isReadOnly && (
                <div className="flex justify-end mb-4">
                    <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}>
                        <ToggleGroupItem value="grid" aria-label="Grid view">
                            <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="list" aria-label="List view">
                            <List className="h-4 w-4" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToFirstScrollableAncestor]}
            >
                <SortableContext
                    items={items.map(s => s.id)}
                    strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
                >
                    <div className={cn(
                        "grid gap-2",
                        viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1"
                    )}>
                        {items.map((item) => (
                            <SortableItemCard
                                key={item.id}
                                item={item}
                                onClick={() => {
                                    if (!isReadOnly && selectedIds.length > 0) {
                                        toggleSelection(item.id)
                                    } else {
                                        setActiveItem(item)
                                    }
                                }}
                                isSelected={selectedIds.includes(item.id)}
                                onSelect={() => toggleSelection(item.id)}
                                onDelete={() => handleSingleDelete(item.id)}
                                isReadOnly={isReadOnly}
                                username={username}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            <Dialog open={!!activeItem || isCreatingOpen} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="sm:max-w-[90vw] md:max-w-3xl h-[80vh] md:h-[60vh] p-0 gap-0 overflow-hidden bg-background">
                    <VisuallyHidden>
                        <DialogTitle>{isCreatingOpen ? 'New Item' : 'Edit Item'}</DialogTitle>
                    </VisuallyHidden>
                    {(activeItem || isCreatingOpen) && (
                        <div className="flex flex-col h-full overflow-y-auto">
                            <ItemEditor
                                snippet={activeItem || undefined}
                                username={username}
                                displayName={displayName}
                                onClose={handleClose}
                                readOnly={isReadOnly}
                                onCreated={(newItem) => {
                                    setItems(prev => {
                                        if (prev.some(i => i.id === newItem.id)) return prev;
                                        return [newItem, ...prev];
                                    });
                                }}
                                initialContent={
                                    isCreatingOpen
                                        ? [searchParams.get('content'), searchParams.get('url')].filter(Boolean).join('\n\n')
                                        : undefined
                                }
                                initialTitle={isCreating ? (searchParams.get('title') || '') : undefined}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Bulk Actions Toolbar */}
            {!isReadOnly && selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-background border shadow-2xl rounded-full px-5 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <span className="text-sm font-semibold whitespace-nowrap px-1">
                        {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'}
                    </span>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 rounded-full px-3 hover:bg-accent"
                            onClick={() => setSelectedIds([])}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs h-8 rounded-full px-4 shadow-sm cursor-pointer"
                            onClick={handleBulkDelete}
                            disabled={isPending}
                        >
                            {isPending ? "..." : "Delete"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItemCard({ item, onClick, isSelected, onSelect, onDelete, isReadOnly, username }: {
    item: any,
    onClick: () => void,
    isSelected: boolean,
    onSelect: () => void,
    onDelete?: () => void,
    isReadOnly?: boolean,
    username?: string
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id, disabled: isReadOnly })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : 1,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div ref={setNodeRef} style={style} className="h-full">
            <ItemCard
                id={item.id}
                title={item.title}
                content={item.content}
                language={item.language}
                slug={item.slug}
                alias={item.alias}
                onClick={onClick}
                dragHandleProps={!isReadOnly ? { ...attributes, ...listeners } : undefined}
                isSelected={isSelected}
                onSelect={onSelect}
                onDelete={onDelete}
                isReadOnly={isReadOnly}
                username={username}
            />
        </div>
    )
}
