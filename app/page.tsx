import { SearchBar } from "@/components/feature/SearchBar";
import { ItemList } from "@/components/feature/ItemList";
import { ClipboardHistory } from "@/components/feature/ClipboardHistory";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { NewItemButton } from "@/components/feature/NewItemButton";
import { ItemRealtimeListener } from "@/components/feature/ItemRealtimeListener";
import { UsernameModal } from "@/components/feature/UsernameModal";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { navItems } from "@/lib/nav-items";

export const revalidate = 0;

export default async function Home(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams;
  const query = (searchParams.q as string)?.toLowerCase() || '';
  const typeFilter = (searchParams.type as string) || '';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login if unauthenticated? 
    // For now assuming existing auth middleware might handle this, 
    // or we render a landing page.
    // Given the context "personal manager", let's assuming we want to force login or show nothing.
    // I'll return a simple landing message if no user.
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <div className="relative w-24 h-24 mb-6 rounded-full overflow-hidden shadow-lg">
          <Image
            src="/logo.png"
            alt="Linksaw Logo"
            fill
            className="object-cover"
          />
        </div>
        <h1 className="text-4xl font-bold mb-4">linksaw</h1>
        <p className="text-muted-foreground mb-8">Personal link and clip manager.</p>
        <Link href="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    )
  }

  // Fetch Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch Items
  let queryBuilder = supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id) // Strict filtering by user
    .is('deleted_at', null)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false });

  // Apply Type Filter
  if (typeFilter) {
    if (typeFilter === 'clip') {
      queryBuilder = queryBuilder.eq('type', 'clip');
    } else if (typeFilter === 'link') {
      queryBuilder = queryBuilder.eq('type', 'link');
    } else if (typeFilter === 'text' || typeFilter === 'snip') {
      queryBuilder = queryBuilder.neq('type', 'link').neq('type', 'clip'); // 'text' (formerly snip) is everything else
    }
  } else {
    // Default view: Everything EXCEPT clips? Or Everything?
    // Previously we excluded clips. Let's keep excluding clips unless explicitly asked or unified view.
    // "All Items" usually implies Links + Snips. Clips are usually separate history.
    // But user said "links snips and clips goes".
    // If no type is selected (Home), let's show links and snips (no filters aside from not clips).
    queryBuilder = queryBuilder.neq('type', 'clip');
  }

  if (query) {
    // If searching, search across everything valid for the current view?
    // Or restart builder?
    // Re-applying logic with search
    queryBuilder = supabase
      .from('items')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    if (typeFilter) {
      if (typeFilter === 'clip') queryBuilder = queryBuilder.eq('type', 'clip');
      if (typeFilter === 'link') queryBuilder = queryBuilder.eq('type', 'link');
      if (typeFilter === 'text' || typeFilter === 'snip') queryBuilder = queryBuilder.neq('type', 'link').neq('type', 'clip');
    } else {
      queryBuilder = queryBuilder.neq('type', 'clip');
    }
  }

  const { data: snippets, error } = await queryBuilder;

  if (query) {
    console.log(`[Search] Query: "${query}", Results: ${snippets?.length || 0}`);
  }

  if (error) {
    console.error("Error fetching items:", error);
  }

  const showUsernameModal = !profile?.username;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <UsernameModal initialIsOpen={showUsernameModal} />

      {/* Global Header */}
      <header className="fixed top-0 left-0 right-0 h-[57px] border-b bg-background/80 backdrop-blur-md z-50 flex items-center px-4 justify-between gap-4">
        {/* Mobile Menu + Logo / Branding */}
        <div className="flex items-center gap-2 shrink-0">
          <MobileNav items={navItems} />
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-full overflow-hidden">
              <Image
                src="/logo.png"
                alt="Linksaw Logo"
                fill
                className="object-cover"
              />
            </div>
            <span className="font-bold text-lg hidden sm:inline-block">linksaw</span>
            {profile?.username && (
              <span className="text-sm font-normal text-muted-foreground hidden sm:inline-block ml-1">
                @{profile.username}
              </span>
            )}
          </Link>

          {/* Divider & Page Title (Optional) */}
          <div className="h-4 w-[1px] bg-border mx-2 hidden md:block" />
          <h1 className="text-sm font-medium text-muted-foreground hidden md:block capitalize">
            {typeFilter ? `${typeFilter}s` : 'All Items'}
          </h1>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end min-w-0">
          <div className="w-full max-w-[200px] md:max-w-xs">
            <SearchBar />
          </div>
          <div className="hidden md:block">
            <NewItemButton />
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="pt-[57px] flex min-h-screen">
        {/* Sidebar - Fixed Position set in component (top-[57px]) */}
        <Sidebar className="hidden md:flex" />

        {/* Content Wrapper */}
        <main className="flex-1 flex flex-col md:pl-[60px] transition-all">
          <div className="container mx-auto px-4 py-6 flex-1">
            <ItemList initialItems={snippets || []} username={profile?.username} />
            <ItemRealtimeListener />
          </div>
        </main>
      </div>

      {/* Mobile Floating Action Button */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <Link href="/items/new">
          <Button size="icon" className="h-14 w-14 rounded-full bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black shadow-lg">
            <Plus className="h-6 w-6" />
            <span className="sr-only">New Item</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
