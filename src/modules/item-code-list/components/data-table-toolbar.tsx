"use client"

import type { Table } from "@tanstack/react-table"
import { Database, Download, RefreshCcw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import { AddItemCodeListSheet } from "./add-item-code-list-sheet"
import { ImportItemCodeListDialog } from "./import-item-code-list-dialog"
import type { ItemCodeList } from "@/modules/item-code-list/services/types/item-code-list-types"

function downloadTemplate() {
  import("xlsx").then((XLSX) => {
    const wb = XLSX.utils.book_new()
    const headers = [
      "MAVCode",
      "MHBCode",
      "IzuyoshiJPCode",
      "IzuyoshiVNCode",
      "Description",
    ]
    const sampleRows = [
      ["MAVcode001", "", "Jcode0018", "VNcode0018", "白地に黒プリント　(特記事項参照)"],
      ["MAVcode002", "", "Jcode0019", "VNcode0019", "白地に黒プリント　(特記事項参照)"],
      ["MAVcode003", "", "Jcode0020", "VNcode0020", "Aluminum Plate 100mm x 200mm x 5mm"],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])
    XLSX.utils.book_append_sheet(wb, ws, "ItemCodeList Template")
    XLSX.writeFile(wb, "ItemCodeList_Import_Template.csv")
  })
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  onAddItem?: (item: ItemCodeList) => void | Promise<void>
  onImportItems?: (items: ItemCodeList[]) => void | Promise<void>
  onSeedItems?: () => void | Promise<void>
  isSeedingItems?: boolean
}

export function DataTableToolbar<TData>({
  table,
  onAddItem,
  onImportItems,
  onSeedItems,
  isSeedingItems,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    (table.getState().globalFilter?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4 pointer-events-none" />
            <Input
              placeholder="Search all columns..."
              value={table.getState().globalFilter ?? ""}
              onChange={(event) =>
                table.setGlobalFilter(event.target.value)
              }
              className="pl-8 w-[240px] lg:w-[320px] cursor-text"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              table.resetColumnFilters()
              table.resetGlobalFilter()
            }}
            className="px-3 cursor-pointer"
            disabled={!isFiltered}
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden lg:block">Reset</span>
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
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={downloadTemplate}
          >
            <Download className="h-4 w-4" />
            <span className="hidden lg:block">Template</span>
          </Button>
          <ImportItemCodeListDialog onImportItems={onImportItems} />
          <AddItemCodeListSheet onAddItem={onAddItem} />
        </div>
      </div>
    </div>
  )
}
