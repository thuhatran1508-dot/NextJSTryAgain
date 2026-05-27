"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { Checkbox } from "@/components/ui/checkbox"
import type { ItemCodeList } from "@/modules/item-code-list/services/types/item-code-list-types"
import { DataTableColumnHeader } from "./data-table-column-header"
import { DataTableRowActions } from "./data-table-row-actions"

interface ItemCodeListColumnActions {
  onUpdateItem?: (item: ItemCodeList) => void | Promise<void>
  onDeleteItem?: (itemId: string) => void | Promise<void>
}

export function getItemCodeListColumns({
  onUpdateItem,
  onDeleteItem,
}: ItemCodeListColumnActions = {}): ColumnDef<ItemCodeList>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px] cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px] cursor-pointer"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "MAVCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="MAV Code" />
      ),
      cell: ({ row }) => (
        <div className="w-[130px] font-medium">
          {row.getValue("MAVCode")}
        </div>
      ),
    },
    {
      accessorKey: "MHBCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="MHB Code" />
      ),
      cell: ({ row }) => (
        <div className="w-[130px]">
          {row.getValue("MHBCode")}
        </div>
      ),
    },
    {
      accessorKey: "IzuyoshiJPCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Izuyoshi JP Code" />
      ),
      cell: ({ row }) => (
        <div className="w-[150px]">
          {row.getValue("IzuyoshiJPCode")}
        </div>
      ),
    },
    {
      accessorKey: "IzuyoshiVNCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Izuyoshi VN Code" />
      ),
      cell: ({ row }) => (
        <div className="w-[150px]">
          {row.getValue("IzuyoshiVNCode")}
        </div>
      ),
    },
    {
      accessorKey: "Description",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[400px] truncate">
          {row.getValue("Description")}
        </div>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions
          row={row}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
        />
      ),
    },
  ]
}

export const columns = getItemCodeListColumns()
