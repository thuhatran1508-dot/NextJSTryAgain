"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getItemCodeListColumns } from "@/modules/item-code-list/components/columns"
import { DataTable } from "@/modules/item-code-list/components/data-table"
import {
  createItemCodeList,
  deleteItemCodeList,
  getItemCodeList,
  seedItemCodeListWithClient,
  updateItemCodeList,
} from "@/modules/item-code-list/services/item-code-list-services"
import type { ItemCodeList } from "@/modules/item-code-list/services/types/item-code-list-types"

export default function ItemCodeListPage() {
  const [items, setItems] = useState<ItemCodeList[]>([])
  const [loading, setLoading] = useState(true)
  const [isSeedingItems, setIsSeedingItems] = useState(false)

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

  const handleAddItem = useCallback(
    async (newItem: ItemCodeList) => {
      await createItemCodeList(newItem)
      await refreshItems()
    },
    [refreshItems]
  )

  const handleUpdateItem = useCallback(async (item: ItemCodeList) => {
    await updateItemCodeList(item)
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
  }, [])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    await deleteItemCodeList(itemId)
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const handleSeedItems = useCallback(async () => {
    try {
      setIsSeedingItems(true)
      const seededItems = await seedItemCodeListWithClient()
      setItems(seededItems)
    } catch (error) {
      console.error("Failed to seed ItemCodeList:", error)
    } finally {
      setIsSeedingItems(false)
    }
  }, [])

  const itemColumns = useMemo(
    () =>
      getItemCodeListColumns({
        onUpdateItem: handleUpdateItem,
        onDeleteItem: handleDeleteItem,
      }),
    [handleDeleteItem, handleUpdateItem]
  )

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
          Manage your ItemCodeList entries. Track MAV, MHB, and Izuyoshi codes.
        </p>
      </div>

      <div className="h-full flex-1 flex-col space-y-6 px-4 md:px-6 md:flex">
        <Card>
          <CardHeader>
            <CardTitle>ItemCodeList Management</CardTitle>
            <CardDescription>
              View, filter, and manage all ItemCodeList entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={items}
              columns={itemColumns}
              onAddItem={handleAddItem}
              onSeedItems={handleSeedItems}
              isSeedingItems={isSeedingItems}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
