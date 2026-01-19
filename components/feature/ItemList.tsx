'use client'

import { useState, useTransition } from 'react'
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
    rectSortingStrategy
} from '@dnd-kit/sortable'
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers'
import { ItemCard } from './ItemCard'
import { updateItemOrder } from '@/actions/items'
import { useEffect } from 'react'

interface Item {
    id: string
    title: string
    content: string
    language?: string
    slug?: string
    order_index: number
    type?: string
}

interface ItemListProps {
    initialItems: any[]
}

export function ItemList({ initialItems }: ItemListProps) {
    const [items, setItems] = useState(initialItems)
    const [isPending, startTransition] = useTransition()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Sync state with props when server-side data refreshes (Realtime)
    useEffect(() => {
        setItems(initialItems)
    }, [initialItems])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Avoid accidental drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    if (!mounted) {
        // Render a static version during SSR/Hydration to avoid mismatch
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {initialItems.map((item) => (
                    <ItemCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        content={item.content}
                        language={item.language}
                        slug={item.slug}
                    />
                ))}
            </div>
        )
    }

    const handleDragEnd = async (event: DragEndEvent) => {
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

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToFirstScrollableAncestor]}
        >
            <SortableContext
                items={items.map(s => s.id)}
                strategy={rectSortingStrategy}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((item) => (
                        <SortableItemCard
                            key={item.id}
                            item={item}
                        />
                    ))}
                    {items.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No items found. Press 'N' to create one!
                        </div>
                    )}
                </div>
            </SortableContext>
        </DndContext>
    )
}

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItemCard({ item }: { item: any }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id })

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
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    )
}
