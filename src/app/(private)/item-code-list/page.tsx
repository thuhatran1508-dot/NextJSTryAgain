"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, FileText, RefreshCcw, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  createItemCodeList,
  deleteItemCodeList,
  getItemCodeList,
  seedItemCodeListWithClient,
  updateItemCodeList,
} from "@/modules/item-code-list/services/item-code-list-services"
import type { ItemCodeList } from "@/modules/item-code-list/services/types/item-code-list-types"
import { ItemDetailPanel } from "@/modules/item-code-list/components/item-detail-panel"
import { AddItemCodeListSheet } from "@/modules/item-code-list/components/add-item-code-list-sheet"

export default function ItemCodeListPage() {
  const [items, setItems] = useState<ItemCodeList[]>([])
  const [loading, setLoading] = useState(true)
  const [isSeedingItems, setIsSeedingItems] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const refreshItems = useCallback(async () => {
    const list = await getItemCodeList()
    setItems(list)
  }, [])

  useEffect(() => {
    const loadItems = async () => {
      try {
        await refreshItems()
      } catch (error) {
        console.error("Failed to load ItemCodeList:", error)
      } finally {
        setLoading(false)
      }
    }

    loadItems()
  }, [refreshItems])

  useEffect(() => {
    if (items.length > 0 && !selectedId) {
      setSelectedId(items[0].id)
    }
  }, [items, selectedId])

  const handleSeedItems = useCallback(async () => {
    try {
      setIsSeedingItems(true)
      const seededItems = await seedItemCodeListWithClient()
      setItems(seededItems)
      if (seededItems.length > 0) {
        setSelectedId(seededItems[0].id)
      }
      toast.success(`Seeded ${seededItems.length} items`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to seed data")
    } finally {
      setIsSeedingItems(false)
    }
  }, [])

  const handleAddItem = useCallback(
    async (newItem: ItemCodeList) => {
      await createItemCodeList(newItem)
      await refreshItems()
      setSelectedId(newItem.id)
    },
    [refreshItems]
  )

  const handleUpdateItem = useCallback(
    async (item: ItemCodeList) => {
      await updateItemCodeList(item)
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
    },
    []
  )

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      await deleteItemCodeList(itemId)
      setItems((prev) => {
        const remaining = prev.filter((i) => i.id !== itemId)
        if (selectedId === itemId) {
          setSelectedId(remaining.length > 0 ? remaining[0].id : null)
        }
        return remaining
      })
    },
    [selectedId]
  )

  const selectedItem = items.find((i) => i.id === selectedId) ?? null

  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase()
    return (
      item.id.toLowerCase().includes(q) ||
      item.IzuyoshiJPCode.toLowerCase().includes(q) ||
      item.IzuyoshiVNCode.toLowerCase().includes(q) ||
      item.Description.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading ItemCodeList...</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight">ItemCodeList</h1>
        <p className="text-muted-foreground">
          Manage your ItemCodeList entries. Data synced from Firebase Firestore.
        </p>
      </div>

      <div className="flex-1 px-4 md:px-6 pb-4">
        <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-14rem)] min-h-0 rounded-lg border">
          {/* Left: Document List */}
          <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">ItemCodeList</span>
                  <span className="ml-1 text-xs text-muted-foreground">({filteredItems.length})</span>
                </div>
                <AddItemCodeListSheet onAddItem={handleAddItem} />
              </div>

              {/* Toolbar */}
              <div className="px-2 py-2 border-b space-y-2">
                <div className="relative">
                  <Search className="text-muted-foreground absolute left-2 top-2.5 h-3.5 w-3.5" />
                  <Input
                    placeholder="Filter documents..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs flex-1 cursor-pointer"
                    onClick={handleSeedItems}
                    disabled={isSeedingItems}
                  >
                    <Database className="h-3 w-3 mr-1" />
                    {isSeedingItems ? "Syncing..." : "Sync Firestore"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs cursor-pointer"
                    onClick={refreshItems}
                  >
                    <RefreshCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Document List */}
              <ScrollArea className="flex-1">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                    <FileText className="h-8 w-8 mb-2 opacity-50" />
                    <p>No documents found</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 border-b hover:bg-accent/50 transition-colors cursor-pointer",
                        selectedId === item.id && "bg-accent"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{item.id}</span>
                        {selectedId === item.id && (
                          <span className="ml-2 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.Description || "No description"}
                      </p>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right: Detail Panel */}
          <ResizablePanel defaultSize={75} minSize={40}>
            {selectedItem ? (
              <ItemDetailPanel
                item={selectedItem}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-12 w-12 opacity-30" />
                  <p className="text-sm">Select a document to view details</p>
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}
