"use client"

import type { Table } from "@tanstack/react-table"
import { Database, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import { AddItemCodeListSheet } from "./add-item-code-list-sheet"
import type { ItemCodeList } from "@/modules/item-code-list/services/types/item-code-list-types"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  onAddItem?: (item: ItemCodeList) => void | Promise<void>
  onSeedItems?: () => void | Promise<void>
  isSeedingItems?: boolean
}

export function DataTableToolbar<TData>({
  table,
  onAddItem,
  onSeedItems,
  isSeedingItems,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search description..."
            value={(table.getColumn("Description")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("Description")?.setFilterValue(event.target.value)
            }
            className=" w-[200px] lg:w-[300px] cursor-text"
          />
          <Button
            variant="outline"
            onClick={() => table.resetColumnFilters()}
            className="px-3 cursor-pointer"
            disabled={!isFiltered}
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden lg:block">Reset Filters</span>
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={onSeedItems}
            disabled={!onSeedItems || isSeedingItems}
          >
            <Database className="h-4 w-4" />
            <span className="hidden lg:block">
              {isSeedingItems ? "Seeding..." : "Seed Data"}
            </span>
          </Button>
          <DataTableViewOptions table={table} />
          <AddItemCodeListSheet onAddItem={onAddItem} />
        </div>
      </div>
    </div>
  )
}
