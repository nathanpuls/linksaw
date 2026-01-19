import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateItem } from "@/actions/items";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function EditItemPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { data: item, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', params.id)
        .single();

    if (error || !item) {
        notFound();
    }

    const updateItemWithId = updateItem.bind(null, item.id);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b bg-card/30 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-4">
                    <Link href={`/items/${item.id}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Cancel Edit
                    </Link>
                </div>
            </header>

            <main className="container mx-auto px-4 py-12 max-w-2xl">
                <h1 className="text-2xl font-bold mb-6">Edit Item</h1>
                <form action={updateItemWithId} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="title" className="text-sm font-medium">Title</label>
                        <Input id="title" name="title" defaultValue={item.title} placeholder="Item Title" required />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="language" className="text-sm font-medium">Language</label>
                        <Input id="language" name="language" defaultValue={item.language} placeholder="text" />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="content" className="text-sm font-medium">Content</label>
                        <Textarea
                            id="content"
                            name="content"
                            defaultValue={item.content}
                            className="min-h-[300px] font-mono"
                            placeholder="Type your item here..."
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-4">
                        <Link href={`/items/${item.id}`}>
                            <Button variant="outline" type="button">Cancel</Button>
                        </Link>
                        <Button type="submit">Save Changes</Button>
                    </div>
                </form>
            </main>
        </div>
    );
}
