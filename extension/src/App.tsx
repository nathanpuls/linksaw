import { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabase'
import { Input } from './components/ui/input'
import { Button } from './components/ui/button'
import { Textarea } from './components/ui/textarea'
import { Toaster } from './components/ui/sonner'
import { Plus, Search, Copy, Pencil, Trash, ArrowLeft, Cloud, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useDebouncedCallback } from 'use-debounce'

interface Item {
  id: string
  title: string
  content: string
  language?: string
  slug?: string
  created_at?: string
  deleted_at?: string
  type?: string
}

function App() {
  const [items, setItems] = useState<Item[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [mode, setMode] = useState<'items' | 'history'>('items')
  const [activeItem, setActiveItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null)

  // Editor State
  const [editorContent, setEditorContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchItems()
    fetchHistory()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('items')
      .select('*')
      .is('deleted_at', null)
      .neq('type', 'clip')
      .order('created_at', { ascending: false })

    if (data) {
      setItems(data)
    }
    setLoading(false)
  }

  async function fetchHistory() {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('type', 'clip')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setHistory(data)
    }
    setHistoryLoading(false)
  }

  const handleCopyHistory = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedHistoryId(id)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedHistoryId(null), 2000)
    } catch (err) {
      toast.error("Failed to copy")
    }
  }

  const filteredItems = items.filter(s =>
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.content?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const slug = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    // Type is temporarily 'snip' for new empty items, will be updated on save if it's a link
    const newItem = {
      title: 'Untitled Item',
      content: '',
      language: 'text',
      slug,
      type: 'snip'
    }

    const { data, error } = await supabase.from('items').insert(newItem).select().single()

    if (error) {
      toast.error("Failed to create item")
      return
    }

    if (data) {
      setItems([data, ...items])
      setActiveItem(data)
      setEditorContent('')
      setView('editor')
      toast.success("Item created")
    }
  }

  const handleEdit = (item: Item) => {
    setActiveItem(item)
    setEditorContent(item.content)
    setView('editor')
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm("Delete this item?")) return

    const { error } = await supabase
      .from('items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error("Failed to delete")
    } else {
      setItems(items.filter(s => s.id !== id))
      if (activeItem?.id === id) {
        setView('list')
        setActiveItem(null)
      }
      toast.success("Deleted")
    }
  }

  const handleCopy = async (e: React.MouseEvent | null, content: string) => {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(content)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  // Auto-save logic
  const debouncedUpdate = useDebouncedCallback(async (newContent: string) => {
    if (!activeItem) return
    setSaveStatus('saving')

    const title = newContent.slice(0, 30) || 'Untitled Item'
    const type = newContent.trim().match(/^https?:\/\//) ? 'link' : 'snip';

    const { error } = await supabase
      .from('items')
      .update({ content: newContent, title, type })
      .eq('id', activeItem.id)

    if (error) {
      toast.error("Failed to save")
    } else {
      setSaveStatus('saved')
      // Update local list state
      setItems(items.map(s => s.id === activeItem.id ? { ...s, content: newContent, title, type } : s))
    }
  }, 1000)

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setEditorContent(val)
    debouncedUpdate(val)
  }

  // Auto-resize textarea
  useEffect(() => {
    if (view === 'editor' && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      textareaRef.current.focus()
    }
  }, [view, editorContent])

  return (
    <div className="w-[400px] h-[600px] bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <Toaster position="bottom-center" />

      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-card">
        {view === 'list' ? (
          <>
            <h1 className="font-bold text-lg">linksaw</h1>
            <Button size="sm" onClick={handleCreate} className="h-8">
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => setView('list')} className="h-8 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Cloud className="h-3 w-3" />
                  Saved
                </>
              )}
            </div>
          </>
        )}
      </header>

      {/* Tab Header / Mode Switcher */}
      {view === 'list' && (
        <div className="flex border-b bg-background">
          <button
            onClick={() => setMode('items')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${mode === 'items' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            Items
          </button>
          <button
            onClick={() => {
              setMode('history')
              fetchHistory()
            }}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${mode === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            History
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-3 bg-muted/20">
        {view === 'list' ? (
          <div className="space-y-3">
            {mode === 'items' ? (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    className="pl-9 bg-background"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {loading ? (
                  <div className="flex justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground text-sm">
                    No items found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredItems.map(item => {
                      const isUrl = item.content.trim().startsWith('http://') || item.content.trim().startsWith('https://');

                      return (
                        <div
                          key={item.id}
                          className="group border rounded-lg bg-background hover:border-primary/50 transition-all cursor-pointer overflow-hidden flex flex-col"
                          onClick={() => {
                            if (isUrl) {
                              window.open(item.content.trim(), '_blank', 'noopener,noreferrer')
                            } else {
                              handleEdit(item)
                            }
                          }}
                        >
                          {/* Minimal Header */}
                          <div className="flex items-center justify-end border-b bg-background h-[30px] shrink-0 px-0">
                            <div className="flex items-center h-full" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-full w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-none"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(item.content)
                                  toast.success("Copied to clipboard")
                                }}
                              >
                                <Copy className="h-[14px] w-[14px]" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-full w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-none"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(item)
                                }}
                              >
                                <Pencil className="h-[14px] w-[14px]" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-full w-9 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-none"
                                onClick={(e) => handleDelete(e, item.id)}
                              >
                                <Trash className="h-[14px] w-[14px]" />
                              </Button>
                            </div>
                          </div>

                          <div className="p-3 bg-background font-sans">
                            <p className={`text-sm break-words line-clamp-3 leading-relaxed ${isUrl ? 'underline text-foreground hover:opacity-70 transition-opacity' : 'text-foreground/90'}`}>
                              {item.content}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              /* History Mode */
              <div className="space-y-2">
                {historyLoading ? (
                  <div className="flex justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground text-sm">
                    No history captured yet.
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-start gap-3 p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => handleCopyHistory(item.id, item.content)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-3 break-words text-foreground font-sans">
                          {item.content}
                        </p>
                        {item.source_url && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-full italic">
                            {item.source_url.startsWith('http') ? (
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-foreground transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {new URL(item.source_url).hostname}
                              </a>
                            ) : (
                              <span>{item.source_url}</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center justify-center h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors">
                        {copiedHistoryId === item.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="bg-card border rounded-lg p-1 flex items-start gap-2 shadow-sm min-h-[300px]">
              <div className="pt-2 pl-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground text-center"
                  onClick={() => handleCopy(null, editorContent)}
                  title="Copy to clipboard"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                ref={textareaRef}
                value={editorContent}
                onChange={handleEditorChange}
                className="flex-1 border-none shadow-none resize-none focus-visible:ring-0 p-2 min-h-[200px] font-sans text-sm md:text-base leading-relaxed"
                placeholder="Type your item..."
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App;
