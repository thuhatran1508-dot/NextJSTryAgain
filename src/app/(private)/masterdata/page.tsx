"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Search, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createCusCodeList,
  createItemCodeList,
  createPICWHCodeList,
  createUnitCodeList,
  createUnitPriceList,
  deleteCusCodeList,
  deleteItemCodeList,
  deletePICWHCodeList,
  deleteUnitCodeList,
  deleteUnitPriceList,
  getCusCodeList,
  getItemCodeList,
  getPICWHCodeList,
  getUnitCodeList,
  getUnitPriceList,
  updateCusCodeList,
  updateItemCodeList,
  updatePICWHCodeList,
  updateUnitCodeList,
  updateUnitPriceList,
} from "@/modules/masterdata/services/masterdata-services"
import type {
  CusCodeListItem,
  ItemCodeListItem,
  PICWHCodeListItem,
  UnitCodeListItem,
  UnitPriceListItem,
} from "@/modules/masterdata/services/masterdata-services"

const tabLabels = {
  cus: "得意先・納入先リスト",
  item: "資材コード照合表",
  unitPrice: "単価リスト",
  picwh: "担当者・倉庫コードリスト",
  unitCode: "単位リスト",
} as const

const emptySearchText = "検索条件に一致するデータが見つかりません。"

function normalizeText(value?: string) {
  return String(value ?? "").trim().toLowerCase()
}

function matchesSearch(value: string | undefined, query: string) {
  const normalizedQuery = normalizeText(query)
  return normalizedQuery.length === 0 || normalizeText(value).includes(normalizedQuery)
}

function isDuplicateKey<T extends { id?: string }>(
  list: T[],
  key: keyof T,
  value: string,
  excludeId?: string
) {
  const normalized = normalizeText(value)
  if (!normalized) return false

  return list.some((record) => {
    return (
      record.id !== excludeId &&
      normalizeText(String(record[key] ?? "")) === normalized
    )
  })
}

const templateDefinitions: Record<keyof typeof tabLabels, { headers: string[]; hints: string[]; fileName: string }> = {
  cus: {
    fileName: "CusCodeList-template",
    headers: ["CusCode", "CusNameEng", "CusNameJP", "CusAddress"],
    hints: ["必須、重複不可、例: CUS001", "任意", "任意", "任意"],
  },
  item: {
    fileName: "ItemCodeList-template",
    headers: ["MAVCode", "MHBCode", "IzuyoshiJPCode", "IzuyoshiVNCode", "Description"],
    hints: ["MAVCodeまたはMHBCodeのいずれかを入力", "MAVCodeまたはMHBCodeのいずれかを入力", "必須、重複不可、例: JP001", "任意", "任意"],
  },
  unitPrice: {
    fileName: "UnitPriceList-template",
    headers: ["IzuyoshiJPCode", "UnitPrice"],
    hints: ["必須、重複不可、例: JP001", "任意、数値"],
  },
  picwh: {
    fileName: "PIC.WH.CodeList-template",
    headers: ["PICCode", "WarehouseCode", "DetailWarehouseCode"],
    hints: ["必須、重複不可、例: PIC001", "任意", "任意"],
  },
  unitCode: {
    fileName: "UnitCodeList-template",
    headers: ["OrderUnit", "CsvCode"],
    hints: ["必須、重複不可、例: 個", "任意"],
  },
}

function downloadTemplate(tabKey: keyof typeof tabLabels) {
  const template = templateDefinitions[tabKey]
  if (!template) return

  const csvContent = [template.headers, template.hints]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\r\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${template.fileName}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

type ImportPreviewRow = {
  rowIndex: number
  values: Record<string, string>
  errors: string[]
  valid: boolean
}

const importErrors = {
  header: "ファイルの形式が正しくありません。ヘッダーを確認してください。",
  empty: "インポートするデータがありません。",
}

function getRowValues(tabKey: keyof typeof tabLabels, row: Record<string, string>) {
  const headers = templateDefinitions[tabKey].headers
  return headers.reduce((acc, header) => {
    acc[header] = normalizeText(row[header])
    return acc
  }, {} as Record<string, string>)
}

const exportFileBaseNames: Record<keyof typeof tabLabels, string> = {
  cus: "CusCodeList",
  item: "ItemCodeList",
  unitPrice: "UnitPriceList",
  picwh: "PICWHCodeList",
  unitCode: "UnitCodeList",
}

function getExistingKeySets(tabKey: keyof typeof tabLabels, lists: {
  cus: CusCodeListItem[]
  item: ItemCodeListItem[]
  unitPrice: UnitPriceListItem[]
  picwh: PICWHCodeListItem[]
  unitCode: UnitCodeListItem[]
}) {
  switch (tabKey) {
    case "cus":
      return {
        keyField: "CusCode",
        existingKeys: new Set(lists.cus.map((item) => normalizeText(item.CusCode))),
      }
    case "unitPrice":
      return {
        keyField: "IzuyoshiJPCode",
        existingKeys: new Set(lists.unitPrice.map((item) => normalizeText(item.IzuyoshiJPCode))),
      }
    case "picwh":
      return {
        keyField: "PICCode",
        existingKeys: new Set(lists.picwh.map((item) => normalizeText(item.PICCode))),
      }
    case "unitCode":
      return {
        keyField: "OrderUnit",
        existingKeys: new Set(lists.unitCode.map((item) => normalizeText(item.OrderUnit))),
      }
    default:
      return {
        keyField: "",
        existingKeys: new Set<string>(),
      }
  }
}

function getExportFileName(tabKey: keyof typeof tabLabels, filtered: boolean, extension: string) {
  return `${exportFileBaseNames[tabKey]}_${filtered ? "filtered" : "all"}.${extension}`
}

function getExportRows(tabKey: keyof typeof tabLabels, rows: Array<any>) {
  switch (tabKey) {
    case "cus":
      return rows.map((item) => ({
        CusCode: item.CusCode ?? "",
        CusNameEng: item.CusNameEng ?? "",
        CusNameJP: item.CusNameJP ?? "",
        CusAddress: item.CusAddress ?? "",
      }))
    case "item":
      return rows.map((item) => ({
        MAVCode: item.MAVCode ?? "",
        MHBCode: item.MHBCode ?? "",
        IzuyoshiJPCode: item.IzuyoshiJPCode ?? "",
        IzuyoshiVNCode: item.IzuyoshiVNCode ?? "",
        Description: item.Description ?? "",
      }))
    case "unitPrice":
      return rows.map((item) => ({
        IzuyoshiJPCode: item.IzuyoshiJPCode ?? "",
        UnitPrice: item.UnitPrice ?? "",
      }))
    case "picwh":
      return rows.map((item) => ({
        PICCode: item.PICCode ?? "",
        WarehouseCode: item.WarehouseCode ?? "",
        DetailWarehouseCode: item.DetailWarehouseCode ?? "",
      }))
    case "unitCode":
      return rows.map((item) => ({
        OrderUnit: item.OrderUnit ?? "",
        CsvCode: item.CsvCode ?? "",
      }))
    default:
      return []
  }
}

function exportTabData(tabKey: keyof typeof tabLabels, rows: Array<any>, filtered: boolean, extension: "csv" | "xlsx") {
  try {
    const exportRows = getExportRows(tabKey, rows)
    const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: templateDefinitions[tabKey].headers })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, exportFileBaseNames[tabKey])
    const fileName = getExportFileName(tabKey, filtered, extension)
    XLSX.writeFile(workbook, fileName)
    toast.success(`${tabLabels[tabKey]} をエクスポートしました。`)
  } catch (error) {
    toast.error(`${tabLabels[tabKey]} のエクスポートに失敗しました。`)
    console.error(error)
  }
}

function validateImportRows(
  tabKey: keyof typeof tabLabels,
  rows: Record<string, string>[],
  existingLists: {
    cus: CusCodeListItem[]
    item: ItemCodeListItem[]
    unitPrice: UnitPriceListItem[]
    picwh: PICWHCodeListItem[]
    unitCode: UnitCodeListItem[]
  }
) {
  const values = rows.map((row) => getRowValues(tabKey, row))
  const header = templateDefinitions[tabKey].headers

  const previewRows: ImportPreviewRow[] = values.map((row, index) => ({
    rowIndex: index + 2,
    values: row,
    errors: [],
    valid: true,
  }))

  const fileCounts = new Map<string, number>()
  const fileMAVCounts = new Map<string, number>()
  const fileMHBCounts = new Map<string, number>()

  values.forEach((row) => {
    if (tabKey === "item") {
      const mav = row.MAVCode
      const mhb = row.MHBCode
      if (mav) fileMAVCounts.set(mav, (fileMAVCounts.get(mav) ?? 0) + 1)
      if (mhb) fileMHBCounts.set(mhb, (fileMHBCounts.get(mhb) ?? 0) + 1)
    } else {
      const keyField = templateDefinitions[tabKey].headers[0]
      const value = row[keyField]
      if (value) fileCounts.set(value, (fileCounts.get(value) ?? 0) + 1)
    }
  })

  const existingKeys = getExistingKeySets(tabKey, existingLists)
  const existingMAVs = new Set(existingLists.item.map((item) => normalizeText(item.MAVCode)))
  const existingMHBs = new Set(existingLists.item.map((item) => normalizeText(item.MHBCode)))

  return previewRows.map((previewRow, index) => {
    const row = previewRow.values
    const errors: string[] = []

    if (tabKey === "cus") {
      const key = row.CusCode
      if (!key) errors.push("CusCodeは必須です。")
      if (key && existingKeys.existingKeys.has(key)) errors.push("CusCodeは既に存在します。")
      if (key && (fileCounts.get(key) ?? 0) > 1) errors.push("CusCodeがファイル内で重複しています。")
    } else if (tabKey === "item") {
      const mav = row.MAVCode
      const mhb = row.MHBCode
      const izu = row.IzuyoshiJPCode
      if (!izu) errors.push("IzuyoshiJPCodeは必須です。")
      if (!mav && !mhb) errors.push("MAVCodeまたはMHBCodeのいずれかを入力してください。")
      if (mav && existingMAVs.has(mav)) errors.push("MAVCodeは既に存在します。")
      if (mhb && existingMHBs.has(mhb)) errors.push("MHBCodeは既に存在します。")
      if (mav && (fileMAVCounts.get(mav) ?? 0) > 1) errors.push("MAVCodeがファイル内で重複しています。")
      if (mhb && (fileMHBCounts.get(mhb) ?? 0) > 1) errors.push("MHBCodeがファイル内で重複しています。")
    } else if (tabKey === "unitPrice") {
      const key = row.IzuyoshiJPCode
      if (!key) errors.push("IzuyoshiJPCodeは必須です。")
      if (key && existingKeys.existingKeys.has(key)) errors.push("IzuyoshiJPCodeは既に存在します。")
      if (key && (fileCounts.get(key) ?? 0) > 1) errors.push("IzuyoshiJPCodeがファイル内で重複しています。")
    } else if (tabKey === "picwh") {
      const key = row.PICCode
      if (!key) errors.push("PICCodeは必須です。")
      if (key && existingKeys.existingKeys.has(key)) errors.push("PICCodeは既に存在します。")
      if (key && (fileCounts.get(key) ?? 0) > 1) errors.push("PICCodeがファイル内で重複しています。")
    } else if (tabKey === "unitCode") {
      const key = row.OrderUnit
      if (!key) errors.push("OrderUnitは必須です。")
      if (key && existingKeys.existingKeys.has(key)) errors.push("OrderUnitは既に存在します。")
      if (key && (fileCounts.get(key) ?? 0) > 1) errors.push("OrderUnitがファイル内で重複しています。")
    }

    return {
      ...previewRow,
      errors,
      valid: errors.length === 0,
    }
  })
}

async function parseImportFile(file: File, tabKey: keyof typeof tabLabels) {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
    throw new Error(importErrors.header)
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" })

  if (rows.length === 0) {
    throw new Error(importErrors.empty)
  }

  const headerRow = (rows[0] ?? []).map((value) => String(value ?? "").trim())
  const expected = templateDefinitions[tabKey].headers
  if (headerRow.length !== expected.length || !expected.every((header, index) => header === headerRow[index])) {
    throw new Error(importErrors.header)
  }

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => normalizeText(String(cell)).length > 0))
  if (dataRows.length === 0) {
    throw new Error(importErrors.empty)
  }

  return dataRows.map((row) => {
    return expected.reduce((acc, header, index) => {
      acc[header] = String(row[index] ?? "").trim()
      return acc
    }, {} as Record<string, string>)
  })
}

function renderTable(
  headers: string[],
  rows: string[][],
  actionCells: React.ReactNode[] = [],
  emptyStateText = "データがありません。"
) {
  const hasActions = actionCells.length > 0

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[56vh] rounded-md border border-muted-foreground/10 bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
            {hasActions ? <TableHead>操作</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <TableRow key={`${rowIndex}-${row.join("-")}`}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={`${rowIndex}-${cellIndex}`}>{cell}</TableCell>
                ))}
                {hasActions ? <TableCell>{actionCells[rowIndex]}</TableCell> : null}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={headers.length + (hasActions ? 1 : 0)} className="h-24 text-center text-sm text-muted-foreground">
                {emptyStateText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

const cusCodeSchema = z.object({
  CusCode: z.string().trim().min(1, "CusCodeは必須です。"),
  CusNameEng: z.string().trim().optional(),
  CusNameJP: z.string().trim().optional(),
  CusAddress: z.string().trim().optional(),
})

const itemCodeSchema = z
  .object({
    MAVCode: z.string().trim().optional(),
    MHBCode: z.string().trim().optional(),
    IzuyoshiJPCode: z.string().trim().min(1, "IzuyoshiJPCodeは必須です。"),
    IzuyoshiVNCode: z.string().trim().optional(),
    Description: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.MAVCode && !data.MHBCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MAVCodeまたはMHBCodeのいずれかを入力してください。",
        path: ["MAVCode"],
      })
    }
  })

const unitPriceSchema = z.object({
  IzuyoshiJPCode: z.string().trim().min(1, "IzuyoshiJPCodeは必須です。"),
  UnitPrice: z.string().trim().optional(),
})

const picWhSchema = z.object({
  PICCode: z.string().trim().min(1, "PICCodeは必須です。"),
  WarehouseCode: z.string().trim().optional(),
  DetailWarehouseCode: z.string().trim().optional(),
})

const unitCodeSchema = z.object({
  OrderUnit: z.string().trim().min(1, "OrderUnitは必須です。"),
  CsvCode: z.string().trim().optional(),
})

type CusCodeFormValues = z.infer<typeof cusCodeSchema>
type ItemCodeFormValues = z.infer<typeof itemCodeSchema>
type UnitPriceFormValues = z.infer<typeof unitPriceSchema>
type PicWhFormValues = z.infer<typeof picWhSchema>
type UnitCodeFormValues = z.infer<typeof unitCodeSchema>

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<keyof typeof tabLabels>("cus")
  const [searchQueries, setSearchQueries] = useState<Record<keyof typeof tabLabels, string>>({
    cus: "",
    item: "",
    unitPrice: "",
    picwh: "",
    unitCode: "",
  })

  const [cusCodeList, setCusCodeList] = useState<CusCodeListItem[]>([])
  const [itemCodeList, setItemCodeList] = useState<ItemCodeListItem[]>([])
  const [unitPriceList, setUnitPriceList] = useState<UnitPriceListItem[]>([])
  const [picWhCodeList, setPicWhCodeList] = useState<PICWHCodeListItem[]>([])
  const [unitCodeList, setUnitCodeList] = useState<UnitCodeListItem[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newCusOpen, setNewCusOpen] = useState(false)
  const [newItemOpen, setNewItemOpen] = useState(false)
  const [newUnitPriceOpen, setNewUnitPriceOpen] = useState(false)
  const [newPicWhOpen, setNewPicWhOpen] = useState(false)
  const [newUnitCodeOpen, setNewUnitCodeOpen] = useState(false)

  const [editCusOpen, setEditCusOpen] = useState(false)
  const [editItemOpen, setEditItemOpen] = useState(false)
  const [editUnitPriceOpen, setEditUnitPriceOpen] = useState(false)
  const [editPicWhOpen, setEditPicWhOpen] = useState(false)
  const [editUnitCodeOpen, setEditUnitCodeOpen] = useState(false)

  const [deleteCusOpen, setDeleteCusOpen] = useState(false)
  const [deleteItemOpen, setDeleteItemOpen] = useState(false)
  const [deleteUnitPriceOpen, setDeleteUnitPriceOpen] = useState(false)
  const [deletePicWhOpen, setDeletePicWhOpen] = useState(false)
  const [deleteUnitCodeOpen, setDeleteUnitCodeOpen] = useState(false)

  const [editingCus, setEditingCus] = useState<CusCodeListItem | null>(null)
  const [editingItem, setEditingItem] = useState<ItemCodeListItem | null>(null)
  const [editingUnitPrice, setEditingUnitPrice] = useState<UnitPriceListItem | null>(null)
  const [editingPicWh, setEditingPicWh] = useState<PICWHCodeListItem | null>(null)
  const [editingUnitCode, setEditingUnitCode] = useState<UnitCodeListItem | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importFileName, setImportFileName] = useState("")
  const [importParseError, setImportParseError] = useState<string | null>(null)
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([])
  const [isParsingImportFile, setIsParsingImportFile] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setImportFileName("")
    setImportParseError(null)
    setImportPreviewRows([])
  }, [activeTab])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [cus, items, prices, picwh, units] = await Promise.all([
        getCusCodeList(),
        getItemCodeList(),
        getUnitPriceList(),
        getPICWHCodeList(),
        getUnitCodeList(),
      ])

      setCusCodeList(cus)
      setItemCodeList(items)
      setUnitPriceList(prices)
      setPicWhCodeList(picwh)
      setUnitCodeList(units)
    } catch (err) {
      console.error(err)
      setError("マスタデータの読み込み中にエラーが発生しました。")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleImportFileChange = useCallback(
    async (file: File) => {
      setImportParseError(null)
      setImportPreviewRows([])
      setImportFileName(file.name)
      setIsParsingImportFile(true)

      try {
        const rows = await parseImportFile(file, activeTab)
        const preview = validateImportRows(activeTab, rows, {
          cus: cusCodeList,
          item: itemCodeList,
          unitPrice: unitPriceList,
          picwh: picWhCodeList,
          unitCode: unitCodeList,
        })
        setImportPreviewRows(preview)
      } catch (error) {
        setImportParseError(error instanceof Error ? error.message : importErrors.header)
      } finally {
        setIsParsingImportFile(false)
      }
    },
    [activeTab, cusCodeList, itemCodeList, unitPriceList, picWhCodeList, unitCodeList]
  )

  const handleConfirmImport = useCallback(async () => {
    const rowsToImport = importPreviewRows.filter((row) => row.valid)
    if (rowsToImport.length === 0) return

    setIsImporting(true)

    try {
      for (const row of rowsToImport) {
        const values = row.values
        if (activeTab === "cus") {
          await createCusCodeList({
            CusCode: values.CusCode,
            CusNameEng: values.CusNameEng,
            CusNameJP: values.CusNameJP,
            CusAddress: values.CusAddress,
          })
        }

        if (activeTab === "item") {
          await createItemCodeList({
            MAVCode: values.MAVCode,
            MHBCode: values.MHBCode,
            IzuyoshiJPCode: values.IzuyoshiJPCode,
            IzuyoshiVNCode: values.IzuyoshiVNCode,
            Description: values.Description,
          })
        }

        if (activeTab === "unitPrice") {
          await createUnitPriceList({
            IzuyoshiJPCode: values.IzuyoshiJPCode,
            UnitPrice: values.UnitPrice,
          })
        }

        if (activeTab === "picwh") {
          await createPICWHCodeList({
            PICCode: values.PICCode,
            WarehouseCode: values.WarehouseCode,
            DetailWarehouseCode: values.DetailWarehouseCode,
          })
        }

        if (activeTab === "unitCode") {
          await createUnitCodeList({
            OrderUnit: values.OrderUnit,
            CsvCode: values.CsvCode,
          })
        }
      }

      toast.success("インポートが完了しました。")
      await loadData()
      setImportOpen(false)
      setImportFileName("")
      setImportPreviewRows([])
      setImportParseError(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "インポートに失敗しました。")
    } finally {
      setIsImporting(false)
    }
  }, [activeTab, importPreviewRows, loadData])

  const canConfirmImport = importPreviewRows.length > 0 && importPreviewRows.every((row) => row.valid)
  const importInvalidCount = importPreviewRows.filter((row) => !row.valid).length

  const getCurrentExportRows = (tabKey: keyof typeof tabLabels, filtered: boolean) => {
    switch (tabKey) {
      case "cus":
        return filtered ? filteredCusCodeList : cusCodeList
      case "item":
        return filtered ? filteredItemCodeList : itemCodeList
      case "unitPrice":
        return filtered ? filteredUnitPriceList : unitPriceList
      case "picwh":
        return filtered ? filteredPicWhCodeList : picWhCodeList
      case "unitCode":
        return filtered ? filteredUnitCodeList : unitCodeList
      default:
        return []
    }
  }

  const renderExportDropdown = (tabKey: keyof typeof tabLabels) => {
    const filteredRows = getCurrentExportRows(tabKey, true)
    const filteredDisabled = filteredRows.length === 0

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="cursor-pointer">
            エクスポート
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => exportTabData(tabKey, getCurrentExportRows(tabKey, false), false, "csv")}
          >
            すべてエクスポート (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => exportTabData(tabKey, getCurrentExportRows(tabKey, false), false, "xlsx")}
          >
            すべてエクスポート (Excel)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={filteredDisabled}
            onClick={() => !filteredDisabled && exportTabData(tabKey, filteredRows, true, "csv")}
          >
            検索結果をエクスポート (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={filteredDisabled}
            onClick={() => !filteredDisabled && exportTabData(tabKey, filteredRows, true, "xlsx")}
          >
            検索結果をエクスポート (Excel)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const renderTabTrigger = (key: keyof typeof tabLabels) => (
    <span className="inline-flex items-center gap-2">
      {tabLabels[key]}
      {activeTab === key && importInvalidCount > 0 ? (
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
          {importInvalidCount}
        </span>
      ) : null}
    </span>
  )

  const filteredCusCodeList = useMemo(
    () =>
      cusCodeList.filter(
        (item) =>
          matchesSearch(item.CusCode, searchQueries.cus) ||
          matchesSearch(item.CusNameEng, searchQueries.cus) ||
          matchesSearch(item.CusNameJP, searchQueries.cus) ||
          matchesSearch(item.CusAddress, searchQueries.cus)
      ),
    [cusCodeList, searchQueries.cus]
  )

  const filteredItemCodeList = useMemo(
    () =>
      itemCodeList.filter(
        (item) =>
          matchesSearch(item.MAVCode, searchQueries.item) ||
          matchesSearch(item.MHBCode, searchQueries.item) ||
          matchesSearch(item.IzuyoshiJPCode, searchQueries.item) ||
          matchesSearch(item.IzuyoshiVNCode, searchQueries.item) ||
          matchesSearch(item.Description, searchQueries.item)
      ),
    [itemCodeList, searchQueries.item]
  )

  const filteredUnitPriceList = useMemo(
    () =>
      unitPriceList.filter((item) =>
        matchesSearch(item.IzuyoshiJPCode, searchQueries.unitPrice) ||
        matchesSearch(item.UnitPrice, searchQueries.unitPrice)
      ),
    [unitPriceList, searchQueries.unitPrice]
  )

  const filteredPicWhCodeList = useMemo(
    () =>
      picWhCodeList.filter(
        (item) =>
          matchesSearch(item.PICCode, searchQueries.picwh) ||
          matchesSearch(item.WarehouseCode, searchQueries.picwh) ||
          matchesSearch(item.DetailWarehouseCode, searchQueries.picwh)
      ),
    [picWhCodeList, searchQueries.picwh]
  )

  const filteredUnitCodeList = useMemo(
    () =>
      unitCodeList.filter(
        (item) =>
          matchesSearch(item.OrderUnit, searchQueries.unitCode) ||
          matchesSearch(item.CsvCode, searchQueries.unitCode)
      ),
    [unitCodeList, searchQueries.unitCode]
  )

  const handleSearchChange = (tab: keyof typeof tabLabels, value: string) => {
    setSearchQueries((prev) => ({ ...prev, [tab]: value }))
  }

  const cusCreateForm = useForm<CusCodeFormValues>({
    resolver: zodResolver(cusCodeSchema),
    defaultValues: {
      CusCode: "",
      CusNameEng: "",
      CusNameJP: "",
      CusAddress: "",
    },
  })

  const cusEditForm = useForm<CusCodeFormValues>({
    resolver: zodResolver(cusCodeSchema),
    defaultValues: {
      CusCode: "",
      CusNameEng: "",
      CusNameJP: "",
      CusAddress: "",
    },
  })

  const itemCreateForm = useForm<ItemCodeFormValues>({
    resolver: zodResolver(itemCodeSchema),
    defaultValues: {
      MAVCode: "",
      MHBCode: "",
      IzuyoshiJPCode: "",
      IzuyoshiVNCode: "",
      Description: "",
    },
  })

  const itemEditForm = useForm<ItemCodeFormValues>({
    resolver: zodResolver(itemCodeSchema),
    defaultValues: {
      MAVCode: "",
      MHBCode: "",
      IzuyoshiJPCode: "",
      IzuyoshiVNCode: "",
      Description: "",
    },
  })

  const unitPriceCreateForm = useForm<UnitPriceFormValues>({
    resolver: zodResolver(unitPriceSchema),
    defaultValues: {
      IzuyoshiJPCode: "",
      UnitPrice: "",
    },
  })

  const unitPriceEditForm = useForm<UnitPriceFormValues>({
    resolver: zodResolver(unitPriceSchema),
    defaultValues: {
      IzuyoshiJPCode: "",
      UnitPrice: "",
    },
  })

  const picWhCreateForm = useForm<PicWhFormValues>({
    resolver: zodResolver(picWhSchema),
    defaultValues: {
      PICCode: "",
      WarehouseCode: "",
      DetailWarehouseCode: "",
    },
  })

  const picWhEditForm = useForm<PicWhFormValues>({
    resolver: zodResolver(picWhSchema),
    defaultValues: {
      PICCode: "",
      WarehouseCode: "",
      DetailWarehouseCode: "",
    },
  })

  const unitCodeCreateForm = useForm<UnitCodeFormValues>({
    resolver: zodResolver(unitCodeSchema),
    defaultValues: {
      OrderUnit: "",
      CsvCode: "",
    },
  })

  const unitCodeEditForm = useForm<UnitCodeFormValues>({
    resolver: zodResolver(unitCodeSchema),
    defaultValues: {
      OrderUnit: "",
      CsvCode: "",
    },
  })

  useEffect(() => {
    if (editingCus) {
      cusEditForm.reset({
        CusCode: editingCus.CusCode,
        CusNameEng: editingCus.CusNameEng ?? "",
        CusNameJP: editingCus.CusNameJP ?? "",
        CusAddress: editingCus.CusAddress ?? "",
      })
    }
  }, [editingCus, cusEditForm])

  useEffect(() => {
    if (editingItem) {
      itemEditForm.reset({
        MAVCode: editingItem.MAVCode ?? "",
        MHBCode: editingItem.MHBCode ?? "",
        IzuyoshiJPCode: editingItem.IzuyoshiJPCode,
        IzuyoshiVNCode: editingItem.IzuyoshiVNCode ?? "",
        Description: editingItem.Description ?? "",
      })
    }
  }, [editingItem, itemEditForm])

  useEffect(() => {
    if (editingUnitPrice) {
      unitPriceEditForm.reset({
        IzuyoshiJPCode: editingUnitPrice.IzuyoshiJPCode,
        UnitPrice: editingUnitPrice.UnitPrice ?? "",
      })
    }
  }, [editingUnitPrice, unitPriceEditForm])

  useEffect(() => {
    if (editingPicWh) {
      picWhEditForm.reset({
        PICCode: editingPicWh.PICCode,
        WarehouseCode: editingPicWh.WarehouseCode ?? "",
        DetailWarehouseCode: editingPicWh.DetailWarehouseCode ?? "",
      })
    }
  }, [editingPicWh, picWhEditForm])

  useEffect(() => {
    if (editingUnitCode) {
      unitCodeEditForm.reset({
        OrderUnit: editingUnitCode.OrderUnit,
        CsvCode: editingUnitCode.CsvCode ?? "",
      })
    }
  }, [editingUnitCode, unitCodeEditForm])

  const handleSubmitCusCreate = async (values: CusCodeFormValues) => {
    const normalized = normalizeText(values.CusCode)
    if (isDuplicateKey(cusCodeList, "CusCode", normalized)) {
      cusCreateForm.setError("CusCode", {
        type: "manual",
        message: `CusCode "${values.CusCode.trim()}" は既に存在します。`,
      })
      return
    }

    try {
      await createCusCodeList({
        CusCode: values.CusCode.trim(),
        CusNameEng: values.CusNameEng?.trim(),
        CusNameJP: values.CusNameJP?.trim(),
        CusAddress: values.CusAddress?.trim(),
      })
      toast.success("CusCodeListを作成しました。")
      setNewCusOpen(false)
      cusCreateForm.reset()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました。")
    }
  }

  const handleSubmitCusEdit = async (values: CusCodeFormValues) => {
    if (!editingCus) return
    const normalized = normalizeText(values.CusCode)
    if (isDuplicateKey(cusCodeList, "CusCode", normalized, editingCus.id)) {
      cusEditForm.setError("CusCode", {
        type: "manual",
        message: `CusCode "${values.CusCode.trim()}" は既に存在します。`,
      })
      return
    }

    try {
      await updateCusCodeList({
        ...editingCus,
        CusCode: values.CusCode.trim(),
        CusNameEng: values.CusNameEng?.trim(),
        CusNameJP: values.CusNameJP?.trim(),
        CusAddress: values.CusAddress?.trim(),
      })
      toast.success("CusCodeListを更新しました。")
      setEditCusOpen(false)
      setEditingCus(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました。")
    }
  }

  const handleDeleteCus = async () => {
    if (!editingCus?.id) return
    try {
      await deleteCusCodeList(editingCus.id)
      toast.success("CusCodeListを削除しました。")
      setDeleteCusOpen(false)
      setEditingCus(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    }
  }

  const handleSubmitItemCreate = async (values: ItemCodeFormValues) => {
    const mav = values.MAVCode?.trim() ?? ""
    const mhb = values.MHBCode?.trim() ?? ""
    if (mav && isDuplicateKey(itemCodeList, "MAVCode", mav)) {
      itemCreateForm.setError("MAVCode", {
        type: "manual",
        message: `MAVCode "${mav}" は既に存在します。`,
      })
      return
    }
    if (mhb && isDuplicateKey(itemCodeList, "MHBCode", mhb)) {
      itemCreateForm.setError("MHBCode", {
        type: "manual",
        message: `MHBCode "${mhb}" は既に存在します。`,
      })
      return
    }

    try {
      await createItemCodeList({
        MAVCode: mav,
        MHBCode: mhb,
        IzuyoshiJPCode: values.IzuyoshiJPCode.trim(),
        IzuyoshiVNCode: values.IzuyoshiVNCode?.trim(),
        Description: values.Description?.trim(),
      })
      toast.success("ItemCodeListを作成しました。")
      setNewItemOpen(false)
      itemCreateForm.reset()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました。")
    }
  }

  const handleSubmitItemEdit = async (values: ItemCodeFormValues) => {
    if (!editingItem) return
    const mav = values.MAVCode?.trim() ?? ""
    const mhb = values.MHBCode?.trim() ?? ""
    if (mav && isDuplicateKey(itemCodeList, "MAVCode", mav, editingItem.id)) {
      itemEditForm.setError("MAVCode", {
        type: "manual",
        message: `MAVCode "${mav}" は既に存在します。`,
      })
      return
    }
    if (mhb && isDuplicateKey(itemCodeList, "MHBCode", mhb, editingItem.id)) {
      itemEditForm.setError("MHBCode", {
        type: "manual",
        message: `MHBCode "${mhb}" は既に存在します。`,
      })
      return
    }

    try {
      await updateItemCodeList({
        ...editingItem,
        MAVCode: mav,
        MHBCode: mhb,
        IzuyoshiJPCode: values.IzuyoshiJPCode.trim(),
        IzuyoshiVNCode: values.IzuyoshiVNCode?.trim(),
        Description: values.Description?.trim(),
      })
      toast.success("ItemCodeListを更新しました。")
      setEditItemOpen(false)
      setEditingItem(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました。")
    }
  }

  const handleDeleteItem = async () => {
    if (!editingItem?.id) return
    try {
      await deleteItemCodeList(editingItem.id)
      toast.success("ItemCodeListを削除しました。")
      setDeleteItemOpen(false)
      setEditingItem(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    }
  }

  const handleSubmitUnitPriceCreate = async (values: UnitPriceFormValues) => {
    const code = values.IzuyoshiJPCode.trim()
    if (isDuplicateKey(unitPriceList, "IzuyoshiJPCode", code)) {
      unitPriceCreateForm.setError("IzuyoshiJPCode", {
        type: "manual",
        message: `IzuyoshiJPCode "${code}" は既に存在します。`,
      })
      return
    }

    try {
      await createUnitPriceList({
        IzuyoshiJPCode: code,
        UnitPrice: values.UnitPrice?.trim(),
      })
      toast.success("UnitPriceListを作成しました。")
      setNewUnitPriceOpen(false)
      unitPriceCreateForm.reset()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました。")
    }
  }

  const handleSubmitUnitPriceEdit = async (values: UnitPriceFormValues) => {
    if (!editingUnitPrice) return
    const code = values.IzuyoshiJPCode.trim()
    if (isDuplicateKey(unitPriceList, "IzuyoshiJPCode", code, editingUnitPrice.id)) {
      unitPriceEditForm.setError("IzuyoshiJPCode", {
        type: "manual",
        message: `IzuyoshiJPCode "${code}" は既に存在します。`,
      })
      return
    }

    try {
      await updateUnitPriceList({
        ...editingUnitPrice,
        IzuyoshiJPCode: code,
        UnitPrice: values.UnitPrice?.trim(),
      })
      toast.success("UnitPriceListを更新しました。")
      setEditUnitPriceOpen(false)
      setEditingUnitPrice(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました。")
    }
  }

  const handleDeleteUnitPrice = async () => {
    if (!editingUnitPrice?.id) return
    try {
      await deleteUnitPriceList(editingUnitPrice.id)
      toast.success("UnitPriceListを削除しました。")
      setDeleteUnitPriceOpen(false)
      setEditingUnitPrice(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    }
  }

  const handleSubmitPicWhCreate = async (values: PicWhFormValues) => {
    const code = values.PICCode.trim()
    if (isDuplicateKey(picWhCodeList, "PICCode", code)) {
      picWhCreateForm.setError("PICCode", {
        type: "manual",
        message: `PICCode "${code}" は既に存在します。`,
      })
      return
    }

    try {
      await createPICWHCodeList({
        PICCode: code,
        WarehouseCode: values.WarehouseCode?.trim(),
        DetailWarehouseCode: values.DetailWarehouseCode?.trim(),
      })
      toast.success("PIC.WH.CodeListを作成しました。")
      setNewPicWhOpen(false)
      picWhCreateForm.reset()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました。")
    }
  }

  const handleSubmitPicWhEdit = async (values: PicWhFormValues) => {
    if (!editingPicWh) return
    const code = values.PICCode.trim()
    if (isDuplicateKey(picWhCodeList, "PICCode", code, editingPicWh.id)) {
      picWhEditForm.setError("PICCode", {
        type: "manual",
        message: `PICCode "${code}" は既に存在します。`,
      })
      return
    }

    try {
      await updatePICWHCodeList({
        ...editingPicWh,
        PICCode: code,
        WarehouseCode: values.WarehouseCode?.trim(),
        DetailWarehouseCode: values.DetailWarehouseCode?.trim(),
      })
      toast.success("PIC.WH.CodeListを更新しました。")
      setEditPicWhOpen(false)
      setEditingPicWh(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました。")
    }
  }

  const handleDeletePicWh = async () => {
    if (!editingPicWh?.id) return
    try {
      await deletePICWHCodeList(editingPicWh.id)
      toast.success("PIC.WH.CodeListを削除しました。")
      setDeletePicWhOpen(false)
      setEditingPicWh(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    }
  }

  const handleSubmitUnitCodeCreate = async (values: UnitCodeFormValues) => {
    const code = values.OrderUnit.trim()
    if (isDuplicateKey(unitCodeList, "OrderUnit", code)) {
      unitCodeCreateForm.setError("OrderUnit", {
        type: "manual",
        message: `OrderUnit "${code}" は既に存在します。`,
      })
      return
    }

    try {
      await createUnitCodeList({
        OrderUnit: code,
        CsvCode: values.CsvCode?.trim(),
      })
      toast.success("UnitCodeListを作成しました。")
      setNewUnitCodeOpen(false)
      unitCodeCreateForm.reset()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました。")
    }
  }

  const handleSubmitUnitCodeEdit = async (values: UnitCodeFormValues) => {
    if (!editingUnitCode) return
    const code = values.OrderUnit.trim()
    if (isDuplicateKey(unitCodeList, "OrderUnit", code, editingUnitCode.id)) {
      unitCodeEditForm.setError("OrderUnit", {
        type: "manual",
        message: `OrderUnit "${code}" は既に存在します。`,
      })
      return
    }

    try {
      await updateUnitCodeList({
        ...editingUnitCode,
        OrderUnit: code,
        CsvCode: values.CsvCode?.trim(),
      })
      toast.success("UnitCodeListを更新しました。")
      setEditUnitCodeOpen(false)
      setEditingUnitCode(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました。")
    }
  }

  const handleDeleteUnitCode = async () => {
    if (!editingUnitCode?.id) return
    try {
      await deleteUnitCodeList(editingUnitCode.id)
      toast.success("UnitCodeListを削除しました。")
      setDeleteUnitCodeOpen(false)
      setEditingUnitCode(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    }
  }

  const openEditCus = (item: CusCodeListItem) => {
    setEditingCus(item)
    setEditCusOpen(true)
  }

  const openDeleteCus = (item: CusCodeListItem) => {
    setEditingCus(item)
    setDeleteCusOpen(true)
  }

  const openEditItem = (item: ItemCodeListItem) => {
    setEditingItem(item)
    setEditItemOpen(true)
  }

  const openDeleteItem = (item: ItemCodeListItem) => {
    setEditingItem(item)
    setDeleteItemOpen(true)
  }

  const openEditUnitPrice = (item: UnitPriceListItem) => {
    setEditingUnitPrice(item)
    setEditUnitPriceOpen(true)
  }

  const openDeleteUnitPrice = (item: UnitPriceListItem) => {
    setEditingUnitPrice(item)
    setDeleteUnitPriceOpen(true)
  }

  const openEditPicWh = (item: PICWHCodeListItem) => {
    setEditingPicWh(item)
    setEditPicWhOpen(true)
  }

  const openDeletePicWh = (item: PICWHCodeListItem) => {
    setEditingPicWh(item)
    setDeletePicWhOpen(true)
  }

  const openEditUnitCode = (item: UnitCodeListItem) => {
    setEditingUnitCode(item)
    setEditUnitCodeOpen(true)
  }

  const openDeleteUnitCode = (item: UnitCodeListItem) => {
    setEditingUnitCode(item)
    setDeleteUnitCodeOpen(true)
  }

  const cusActionCells = filteredCusCodeList.map((item) => (
    <div className="flex gap-2" key={item.id}>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => openEditCus(item)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="destructive" size="sm" className="cursor-pointer" onClick={() => openDeleteCus(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ))

  const itemActionCells = filteredItemCodeList.map((item) => (
    <div className="flex gap-2" key={item.id}>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => openEditItem(item)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="destructive" size="sm" className="cursor-pointer" onClick={() => openDeleteItem(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ))

  const unitPriceActionCells = filteredUnitPriceList.map((item) => (
    <div className="flex gap-2" key={item.id}>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => openEditUnitPrice(item)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="destructive" size="sm" className="cursor-pointer" onClick={() => openDeleteUnitPrice(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ))

  const picWhActionCells = filteredPicWhCodeList.map((item) => (
    <div className="flex gap-2" key={item.id}>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => openEditPicWh(item)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="destructive" size="sm" className="cursor-pointer" onClick={() => openDeletePicWh(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ))

  const unitCodeActionCells = filteredUnitCodeList.map((item) => (
    <div className="flex gap-2" key={item.id}>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => openEditUnitCode(item)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="destructive" size="sm" className="cursor-pointer" onClick={() => openDeleteUnitCode(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ))

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">マスタデータ</p>
        <h1 className="text-3xl font-semibold">マスタデータ管理</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          5 つのコレクションをタブで切り替えて、Firestore からデータを読み込みます。
        </p>
      </div>

      <div className="rounded-3xl border border-muted-foreground/10 bg-card p-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as keyof typeof tabLabels)}>
          <TabsList className="grid w-full grid-cols-2 gap-2 md:grid-cols-5">
            <TabsTrigger value="cus">{renderTabTrigger("cus")}</TabsTrigger>
            <TabsTrigger value="item">{renderTabTrigger("item")}</TabsTrigger>
            <TabsTrigger value="unitPrice">{renderTabTrigger("unitPrice")}</TabsTrigger>
            <TabsTrigger value="picwh">{renderTabTrigger("picwh")}</TabsTrigger>
            <TabsTrigger value="unitCode">{renderTabTrigger("unitCode")}</TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-6">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : isLoading ? (
              <div className="rounded-xl border border-muted-foreground/10 bg-muted p-6 text-center text-sm text-muted-foreground">
                読み込み中...
              </div>
            ) : null}

            <TabsContent value="cus" className="p-0">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="検索..."
                    value={searchQueries.cus}
                    onChange={(event) => handleSearchChange("cus", event.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderExportDropdown("cus")}
                  <Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => setImportOpen(true)}>
                    インポート
                  </Button>
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => downloadTemplate("cus")}>テンプレートダウンロード</Button>
                  <Dialog open={newCusOpen} onOpenChange={setNewCusOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="cursor-pointer">
                        <Plus className="mr-2 h-4 w-4" />
                        新規作成
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>CusCodeListを作成</DialogTitle>
                        <DialogDescription>新しい得意先コードを追加してください。</DialogDescription>
                      </DialogHeader>
                      <Form {...cusCreateForm}>
                        <form onSubmit={cusCreateForm.handleSubmit(handleSubmitCusCreate)} className="space-y-4">
                          <FormField
                            control={cusCreateForm.control}
                            name="CusCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>得意先コード *</FormLabel>
                                <FormControl>
                                  <Input placeholder="例: CUS123" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={cusCreateForm.control}
                            name="CusNameEng"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>顧客名（英語）</FormLabel>
                                <FormControl>
                                  <Input placeholder="英語名" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={cusCreateForm.control}
                            name="CusNameJP"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>顧客名（日本語）</FormLabel>
                                <FormControl>
                                  <Input placeholder="日本語名" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={cusCreateForm.control}
                            name="CusAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>住所</FormLabel>
                                <FormControl>
                                  <Input placeholder="住所" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" className="cursor-pointer">
                              保存
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {renderTable(
                ["得意先コード", "顧客名（英語）", "顧客名（日本語）", "住所"],
                filteredCusCodeList.map((item) => [
                  item.CusCode ?? "",
                  item.CusNameEng ?? "",
                  item.CusNameJP ?? "",
                  item.CusAddress ?? "",
                ]),
                cusActionCells
              )}
            </TabsContent>

            <TabsContent value="item" className="p-0">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="検索..."
                    value={searchQueries.item}
                    onChange={(event) => handleSearchChange("item", event.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderExportDropdown("item")}
                  <Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => setImportOpen(true)}>
                    インポート
                  </Button>
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => downloadTemplate("item")}>テンプレートダウンロード</Button>
                  <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="cursor-pointer">
                        <Plus className="mr-2 h-4 w-4" />
                        新規作成
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>ItemCodeListを作成</DialogTitle>
                        <DialogDescription>新しい資材コードエントリを追加してください。</DialogDescription>
                      </DialogHeader>
                      <Form {...itemCreateForm}>
                        <form onSubmit={itemCreateForm.handleSubmit(handleSubmitItemCreate)} className="space-y-4">
                          <FormField
                            control={itemCreateForm.control}
                            name="MAVCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>MAVコード</FormLabel>
                                <FormControl>
                                  <Input placeholder="MAVコードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemCreateForm.control}
                            name="MHBCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>MHBコード</FormLabel>
                                <FormControl>
                                  <Input placeholder="MHBコードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemCreateForm.control}
                            name="IzuyoshiJPCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>伊予吉JPコード *</FormLabel>
                                <FormControl>
                                  <Input placeholder="伊予吉JPコードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemCreateForm.control}
                            name="IzuyoshiVNCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>伊予吉VNコード</FormLabel>
                                <FormControl>
                                  <Input placeholder="伊予吉VNコードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemCreateForm.control}
                            name="Description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>説明</FormLabel>
                                <FormControl>
                                  <Input placeholder="説明を入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" className="cursor-pointer">
                              保存
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {renderTable(
                ["MAVコード", "MHBコード", "伊予吉JPコード", "伊予吉VNコード", "説明"],
                filteredItemCodeList.map((item) => [
                  item.MAVCode ?? "",
                  item.MHBCode ?? "",
                  item.IzuyoshiJPCode ?? "",
                  item.IzuyoshiVNCode ?? "",
                  item.Description ?? "",
                ]),
                itemActionCells
              )}
            </TabsContent>

            <TabsContent value="unitPrice" className="p-0">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="検索..."
                    value={searchQueries.unitPrice}
                    onChange={(event) => handleSearchChange("unitPrice", event.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderExportDropdown("unitPrice")}
                  <Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => setImportOpen(true)}>
                    インポート
                  </Button>
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => downloadTemplate("unitPrice")}>テンプレートダウンロード</Button>
                  <Dialog open={newUnitPriceOpen} onOpenChange={setNewUnitPriceOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="cursor-pointer">
                        <Plus className="mr-2 h-4 w-4" />
                        新規作成
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>UnitPriceListを作成</DialogTitle>
                        <DialogDescription>新しい単価エントリを追加してください。</DialogDescription>
                      </DialogHeader>
                      <Form {...unitPriceCreateForm}>
                        <form onSubmit={unitPriceCreateForm.handleSubmit(handleSubmitUnitPriceCreate)} className="space-y-4">
                          <FormField
                            control={unitPriceCreateForm.control}
                            name="IzuyoshiJPCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>伊予吉JPコード *</FormLabel>
                                <FormControl>
                                  <Input placeholder="伊予吉JPコードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={unitPriceCreateForm.control}
                            name="UnitPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>単価</FormLabel>
                                <FormControl>
                                  <Input placeholder="単価を入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" className="cursor-pointer">
                              保存
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {renderTable(
                ["伊予吉JPコード", "単価"],
                filteredUnitPriceList.map((item) => [item.IzuyoshiJPCode ?? "", item.UnitPrice ?? ""]),
                unitPriceActionCells
              )}
            </TabsContent>

            <TabsContent value="picwh" className="p-0">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="検索..."
                    value={searchQueries.picwh}
                    onChange={(event) => handleSearchChange("picwh", event.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderExportDropdown("picwh")}
                  <Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => setImportOpen(true)}>
                    インポート
                  </Button>
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => downloadTemplate("picwh")}>テンプレートダウンロード</Button>
                  <Dialog open={newPicWhOpen} onOpenChange={setNewPicWhOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="cursor-pointer">
                        <Plus className="mr-2 h-4 w-4" />
                        新規作成
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>PIC.WH.CodeListを作成</DialogTitle>
                        <DialogDescription>新しい担当者・倉庫コードを追加してください。</DialogDescription>
                      </DialogHeader>
                      <Form {...picWhCreateForm}>
                        <form onSubmit={picWhCreateForm.handleSubmit(handleSubmitPicWhCreate)} className="space-y-4">
                          <FormField
                            control={picWhCreateForm.control}
                            name="PICCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>PICコード *</FormLabel>
                                <FormControl>
                                  <Input placeholder="PICコードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={picWhCreateForm.control}
                            name="WarehouseCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>倉庫コード</FormLabel>
                                <FormControl>
                                  <Input placeholder="倉庫コードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={picWhCreateForm.control}
                            name="DetailWarehouseCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>詳細倉庫コード</FormLabel>
                                <FormControl>
                                  <Input placeholder="詳細倉庫コードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" className="cursor-pointer">
                              保存
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {renderTable(
                ["PICコード", "倉庫コード", "詳細倉庫コード"],
                filteredPicWhCodeList.map((item) => [item.PICCode ?? "", item.WarehouseCode ?? "", item.DetailWarehouseCode ?? ""]),
                picWhActionCells
              )}
            </TabsContent>

            <TabsContent value="unitCode" className="p-0">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="検索..."
                    value={searchQueries.unitCode}
                    onChange={(event) => handleSearchChange("unitCode", event.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderExportDropdown("unitCode")}
                  <Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => setImportOpen(true)}>
                    インポート
                  </Button>
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => downloadTemplate("unitCode")}>テンプレートダウンロード</Button>
                  <Dialog open={newUnitCodeOpen} onOpenChange={setNewUnitCodeOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="cursor-pointer">
                        <Plus className="mr-2 h-4 w-4" />
                        新規作成
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>UnitCodeListを作成</DialogTitle>
                        <DialogDescription>新しい単位コードを追加してください。</DialogDescription>
                      </DialogHeader>
                      <Form {...unitCodeCreateForm}>
                        <form onSubmit={unitCodeCreateForm.handleSubmit(handleSubmitUnitCodeCreate)} className="space-y-4">
                          <FormField
                            control={unitCodeCreateForm.control}
                            name="OrderUnit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>発注単位 *</FormLabel>
                                <FormControl>
                                  <Input placeholder="発注単位を入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={unitCodeCreateForm.control}
                            name="CsvCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CSVコード</FormLabel>
                                <FormControl>
                                  <Input placeholder="CSVコードを入力" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" className="cursor-pointer">
                              保存
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {renderTable(
                ["発注単位", "CSVコード"],
                filteredUnitCodeList.map((item) => [item.OrderUnit ?? "", item.CsvCode ?? ""]),
                unitCodeActionCells
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>テンプレートインポート</DialogTitle>
            <DialogDescription>
              CSV / Excel ファイルをアップロードし、取り込み前に内容を確認してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-center">
              <div>
                <p className="text-sm text-muted-foreground">ファイル名</p>
                <p>{importFileName || "まだ選択されていません。"}</p>
              </div>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="file-input file-input-bordered"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    handleImportFileChange(file)
                  }
                }}
              />
            </div>

            {importParseError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {importParseError}
              </div>
            ) : null}

            {importPreviewRows.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">インポートプレビュー</p>
                  <span className="text-xs text-muted-foreground">
                    {importPreviewRows.filter((row) => !row.valid).length} 件のエラーが検出されました。
                  </span>
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.2em] text-slate-600">
                      <tr>
                        <th className="px-3 py-2">行</th>
                        <th className="px-3 py-2">内容</th>
                        <th className="px-3 py-2">状態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {importPreviewRows.map((row, index) => (
                        <tr key={index} className={row.valid ? "bg-white" : "bg-rose-50"}>
                          <td className="px-3 py-2 align-top">{index + 1}</td>
                          <td className="px-3 py-2 whitespace-pre-wrap break-words text-xs">
                            {Object.entries(row.values)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join("\n")}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {row.valid ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">有効</span>
                            ) : (
                              <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">無効</span>
                            )}
                            {row.errors.length > 0 ? (
                              <div className="mt-1 text-xs text-rose-700">
                                {row.errors.map((error) => (
                                  <div key={error}>{error}</div>
                                ))}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              閉じる
            </Button>
            <Button
              type="button"
              onClick={handleConfirmImport}
              disabled={!canConfirmImport || isImporting || isParsingImportFile}
            >
              {isImporting ? "インポート中..." : "確認してインポート"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editCusOpen} onOpenChange={setEditCusOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>CusCodeListを編集</DialogTitle>
            <DialogDescription>得意先コードを編集して保存してください。</DialogDescription>
          </DialogHeader>
          <Form {...cusEditForm}>
            <form onSubmit={cusEditForm.handleSubmit(handleSubmitCusEdit)} className="space-y-4">
              <FormField
                control={cusEditForm.control}
                name="CusCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>得意先コード *</FormLabel>
                    <FormControl>
                      <Input placeholder="例: CUS123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cusEditForm.control}
                name="CusNameEng"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>顧客名（英語）</FormLabel>
                    <FormControl>
                      <Input placeholder="英語名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cusEditForm.control}
                name="CusNameJP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>顧客名（日本語）</FormLabel>
                    <FormControl>
                      <Input placeholder="日本語名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cusEditForm.control}
                name="CusAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>住所</FormLabel>
                    <FormControl>
                      <Input placeholder="住所" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" className="cursor-pointer">
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editItemOpen} onOpenChange={setEditItemOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ItemCodeListを編集</DialogTitle>
            <DialogDescription>資材コードを編集して保存してください。</DialogDescription>
          </DialogHeader>
          <Form {...itemEditForm}>
            <form onSubmit={itemEditForm.handleSubmit(handleSubmitItemEdit)} className="space-y-4">
              <FormField
                control={itemEditForm.control}
                name="MAVCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAVコード</FormLabel>
                    <FormControl>
                      <Input placeholder="MAVコードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemEditForm.control}
                name="MHBCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MHBコード</FormLabel>
                    <FormControl>
                      <Input placeholder="MHBコードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemEditForm.control}
                name="IzuyoshiJPCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>伊予吉JPコード *</FormLabel>
                    <FormControl>
                      <Input placeholder="伊予吉JPコードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemEditForm.control}
                name="IzuyoshiVNCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>伊予吉VNコード</FormLabel>
                    <FormControl>
                      <Input placeholder="伊予吉VNコードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemEditForm.control}
                name="Description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>説明</FormLabel>
                    <FormControl>
                      <Input placeholder="説明を入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" className="cursor-pointer">
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editUnitPriceOpen} onOpenChange={setEditUnitPriceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>UnitPriceListを編集</DialogTitle>
            <DialogDescription>単価エントリを編集して保存してください。</DialogDescription>
          </DialogHeader>
          <Form {...unitPriceEditForm}>
            <form onSubmit={unitPriceEditForm.handleSubmit(handleSubmitUnitPriceEdit)} className="space-y-4">
              <FormField
                control={unitPriceEditForm.control}
                name="IzuyoshiJPCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>伊予吉JPコード *</FormLabel>
                    <FormControl>
                      <Input placeholder="伊予吉JPコードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={unitPriceEditForm.control}
                name="UnitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>単価</FormLabel>
                    <FormControl>
                      <Input placeholder="単価を入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" className="cursor-pointer">
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editPicWhOpen} onOpenChange={setEditPicWhOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>PIC.WH.CodeListを編集</DialogTitle>
            <DialogDescription>担当者・倉庫コードを編集して保存してください。</DialogDescription>
          </DialogHeader>
          <Form {...picWhEditForm}>
            <form onSubmit={picWhEditForm.handleSubmit(handleSubmitPicWhEdit)} className="space-y-4">
              <FormField
                control={picWhEditForm.control}
                name="PICCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PICコード *</FormLabel>
                    <FormControl>
                      <Input placeholder="PICコードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={picWhEditForm.control}
                name="WarehouseCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>倉庫コード</FormLabel>
                    <FormControl>
                      <Input placeholder="倉庫コードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={picWhEditForm.control}
                name="DetailWarehouseCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>詳細倉庫コード</FormLabel>
                    <FormControl>
                      <Input placeholder="詳細倉庫コードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" className="cursor-pointer">
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editUnitCodeOpen} onOpenChange={setEditUnitCodeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>UnitCodeListを編集</DialogTitle>
            <DialogDescription>単位コードを編集して保存してください。</DialogDescription>
          </DialogHeader>
          <Form {...unitCodeEditForm}>
            <form onSubmit={unitCodeEditForm.handleSubmit(handleSubmitUnitCodeEdit)} className="space-y-4">
              <FormField
                control={unitCodeEditForm.control}
                name="OrderUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>発注単位 *</FormLabel>
                    <FormControl>
                      <Input placeholder="発注単位を入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={unitCodeEditForm.control}
                name="CsvCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CSVコード</FormLabel>
                    <FormControl>
                      <Input placeholder="CSVコードを入力" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" className="cursor-pointer">
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCusOpen} onOpenChange={setDeleteCusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除を確認</AlertDialogTitle>
            <AlertDialogDescription>
              このレコードを本当に削除しますか？この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCus} className="cursor-pointer">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteItemOpen} onOpenChange={setDeleteItemOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除を確認</AlertDialogTitle>
            <AlertDialogDescription>
              このItemCodeListを本当に削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="cursor-pointer">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteUnitPriceOpen} onOpenChange={setDeleteUnitPriceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除を確認</AlertDialogTitle>
            <AlertDialogDescription>
              このUnitPriceListを本当に削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUnitPrice} className="cursor-pointer">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletePicWhOpen} onOpenChange={setDeletePicWhOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除を確認</AlertDialogTitle>
            <AlertDialogDescription>
              このPIC.WH.CodeListを本当に削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePicWh} className="cursor-pointer">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteUnitCodeOpen} onOpenChange={setDeleteUnitCodeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除を確認</AlertDialogTitle>
            <AlertDialogDescription>
              このUnitCodeListを本当に削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUnitCode} className="cursor-pointer">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
