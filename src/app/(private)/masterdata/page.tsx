"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  applyDynamicMasterFieldChanges,
  createDynamicMasterDataRecord,
  deleteAllDynamicMasterDataRecords,
  deleteDynamicMasterDataRecord,
  getDynamicMasterData,
  type DynamicMasterDataRecord,
  updateDynamicMasterDataRecord,
} from "@/modules/masterdata/services/masterdata-services"
import {
  masterCollectionConfigRepository,
  normalizeMasterCollectionConfig,
} from "@/modules/masterdata/services/master-collection-config-services"
import type { MasterCollectionConfig, MasterCollectionFieldConfig } from "@/types/firestore-models"

const MASTER_DATA_CHANGED_STORAGE_KEY = "master-data:changed-at"

type RecordDialogMode = "create" | "edit"
type FieldDraft = MasterCollectionFieldConfig

function notifyMasterDataChanged() {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MASTER_DATA_CHANGED_STORAGE_KEY, new Date().toISOString())
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeSearchText(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function normalizeFieldDrafts(fields: FieldDraft[]) {
  const seen = new Set<string>()
  return fields
    .map((field) => ({
      name: field.name.trim(),
      required: Boolean(field.required),
      unique: Boolean(field.unique),
    }))
    .filter((field) => {
      if (!field.name || seen.has(field.name)) return false
      seen.add(field.name)
      return true
    })
}

function getFieldConfigs(config: MasterCollectionConfig) {
  const byName = new Map((config.fieldConfigs ?? []).map((field) => [field.name, field]))
  return config.fields.map((field) => ({
    name: field,
    required: Boolean(byName.get(field)?.required),
    unique: Boolean(byName.get(field)?.unique),
  }))
}

function makeEmptyRecord(config: MasterCollectionConfig): DynamicMasterDataRecord {
  return Object.fromEntries(config.fields.map((field) => [field, ""]))
}

function getLookupKeyField(config: MasterCollectionConfig) {
  return getFieldConfigs(config).find((field) => field.unique)?.name ?? config.fields[0] ?? ""
}

function getLookupKeyValue(config: MasterCollectionConfig, record: DynamicMasterDataRecord) {
  return normalizeText(record[getLookupKeyField(config)])
}

function getRecordId(config: MasterCollectionConfig, record: DynamicMasterDataRecord) {
  return normalizeText(record.id) || getLookupKeyValue(config, record)
}

function matchesRecordSearch(
  config: MasterCollectionConfig,
  record: DynamicMasterDataRecord,
  query: string
) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  return config.fields.some((field) =>
    normalizeSearchText(record[field]).includes(normalizedQuery)
  )
}

function validateRecord(
  config: MasterCollectionConfig,
  record: DynamicMasterDataRecord,
  existingRows: DynamicMasterDataRecord[],
  excludeId = ""
) {
  const errors: string[] = []
  const fieldConfigs = getFieldConfigs(config)
  const lookupKeyField = getLookupKeyField(config)

  fieldConfigs.forEach((fieldConfig) => {
    const value = normalizeText(record[fieldConfig.name])
    const isDocumentIdField = fieldConfig.name === lookupKeyField
    if ((fieldConfig.required || isDocumentIdField) && !value) {
      errors.push(`${fieldConfig.name} は必須です。`)
    }
    if ((fieldConfig.unique || isDocumentIdField) && value) {
      const duplicated = existingRows.some((row) => {
        if (excludeId && getRecordId(config, row) === excludeId) return false
        return normalizeText(row[fieldConfig.name]) === value
      })
      if (duplicated) {
        errors.push(`${fieldConfig.name} は重複できません。`)
      }
    }
  })

  return errors
}

function exportRows(
  config: MasterCollectionConfig,
  rows: DynamicMasterDataRecord[],
  extension: "csv" | "xlsx"
) {
  const data = rows.map((row) =>
    Object.fromEntries(config.fields.map((field) => [field, row[field] ?? ""]))
  )
  const worksheet = XLSX.utils.json_to_sheet(data, { header: config.fields })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, config.collectionName.slice(0, 31))
  XLSX.writeFile(workbook, `${config.collectionName}.${extension}`)
}

async function parseImportFile(file: File, config: MasterCollectionConfig) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
  })

  return rows.map((row) =>
    Object.fromEntries(config.fields.map((field) => [field, normalizeText(row[field])]))
  ) as DynamicMasterDataRecord[]
}

export default function MasterDataPage() {
  const [configs, setConfigs] = useState<MasterCollectionConfig[]>([])
  const [activeCollection, setActiveCollection] = useState("")
  const [recordsByCollection, setRecordsByCollection] = useState<
    Record<string, DynamicMasterDataRecord[]>
  >({})
  const [searchByCollection, setSearchByCollection] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<MasterCollectionConfig | null>(null)
  const [deleteConfigTarget, setDeleteConfigTarget] = useState<MasterCollectionConfig | null>(null)
  const [configDraft, setConfigDraft] = useState({
    collectionName: "",
    displayName: "",
    fields: [{ name: "", required: false, unique: false }] as FieldDraft[],
  })
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [recordDialogMode, setRecordDialogMode] = useState<RecordDialogMode>("create")
  const [recordDraft, setRecordDraft] = useState<DynamicMasterDataRecord>({})
  const [editingRecordId, setEditingRecordId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<DynamicMasterDataRecord | null>(null)
  const [deleteAllTarget, setDeleteAllTarget] = useState<MasterCollectionConfig | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const activeConfig = useMemo(
    () => configs.find((config) => config.collectionName === activeCollection) ?? null,
    [activeCollection, configs]
  )
  const activeRows = activeConfig
    ? recordsByCollection[activeConfig.collectionName] ?? []
    : []
  const filteredRows = activeConfig
    ? activeRows.filter((row) =>
        matchesRecordSearch(activeConfig, row, searchByCollection[activeConfig.collectionName] ?? "")
      )
    : []

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const nextConfigs = await masterCollectionConfigRepository.list()
      setConfigs(nextConfigs)
      setActiveCollection((current) => current || nextConfigs[0]?.collectionName || "")

      const nextRecords = Object.fromEntries(
        await Promise.all(
          nextConfigs.map(async (config) => [
            config.collectionName,
            await getDynamicMasterData(config),
          ])
        )
      ) as Record<string, DynamicMasterDataRecord[]>
      setRecordsByCollection(nextRecords)
    } catch (error) {
      console.error(error)
      toast.error("マスタデータを読み込めませんでした。")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openNewConfigDialog() {
    setEditingConfig(null)
    setConfigDraft({
      collectionName: "",
      displayName: "",
      fields: [{ name: "", required: false, unique: false }],
    })
    setConfigDialogOpen(true)
  }

  function openEditConfigDialog(config: MasterCollectionConfig) {
    setEditingConfig(config)
    setConfigDraft({
      collectionName: config.collectionName,
      displayName: config.displayName,
      fields: getFieldConfigs(config),
    })
    setConfigDialogOpen(true)
  }

  async function saveConfig() {
    const fieldConfigs = normalizeFieldDrafts(configDraft.fields)
    const fields = fieldConfigs.map((field) => field.name)
    const collectionName = configDraft.collectionName.trim()
    if (!collectionName || !fields.length) {
      toast.error("データリストIDとフィールドを入力してください。")
      return
    }

    setSaving(true)
    try {
      const saved = await masterCollectionConfigRepository.save(
        normalizeMasterCollectionConfig({
          id: collectionName,
          collectionName,
          displayName: configDraft.displayName || collectionName,
          fields,
          fieldConfigs,
          active: true,
          systemDefault: editingConfig?.systemDefault,
        })
      )
      if (editingConfig) {
        await applyDynamicMasterFieldChanges(saved, editingConfig.fields, fields)
      }
      setConfigDialogOpen(false)
      setActiveCollection(saved.collectionName)
      await loadData()
      toast.success("データリストを保存しました。")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  async function deleteConfig() {
    if (!deleteConfigTarget) return
    setSaving(true)
    try {
      await masterCollectionConfigRepository.delete(deleteConfigTarget.collectionName)
      setDeleteConfigTarget(null)
      setConfigDialogOpen(false)
      setActiveCollection((current) => {
        if (current !== deleteConfigTarget.collectionName) return current
        return configs.find((config) => config.collectionName !== deleteConfigTarget.collectionName)
          ?.collectionName ?? ""
      })
      await loadData()
      toast.success("データリストを削除しました。")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  function updateConfigField(index: number, value: string) {
    setConfigDraft((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, name: value } : field
      ),
    }))
  }

  function updateConfigFieldFlag(
    index: number,
    key: "required" | "unique",
    value: boolean
  ) {
    setConfigDraft((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => {
        if (fieldIndex !== index) return field
        return {
          ...field,
          [key]: value,
        }
      }),
    }))
  }

  function addConfigField() {
    setConfigDraft((current) => ({
      ...current,
      fields: [...current.fields, { name: "", required: false, unique: false }],
    }))
  }

  function removeConfigField(index: number) {
    setConfigDraft((current) => ({
      ...current,
      fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index),
    }))
  }

  function moveConfigField(index: number, direction: -1 | 1) {
    setConfigDraft((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.fields.length) return current
      const fields = [...current.fields]
      const [field] = fields.splice(index, 1)
      fields.splice(nextIndex, 0, field)
      return {
        ...current,
        fields,
      }
    })
  }

  function openCreateRecordDialog(config: MasterCollectionConfig) {
    setRecordDialogMode("create")
    setEditingRecordId("")
    setRecordDraft(makeEmptyRecord(config))
    setRecordDialogOpen(true)
  }

  function openEditRecordDialog(config: MasterCollectionConfig, record: DynamicMasterDataRecord) {
    setRecordDialogMode("edit")
    setEditingRecordId(getRecordId(config, record))
    setRecordDraft(
      Object.fromEntries(config.fields.map((field) => [field, normalizeText(record[field])]))
    )
    setRecordDialogOpen(true)
  }

  async function saveRecord() {
    if (!activeConfig) return
    const lookupKeyField = getLookupKeyField(activeConfig)
    const lookupKey = normalizeText(recordDraft[lookupKeyField])
    if (!lookupKey) {
      toast.error(`${lookupKeyField} を入力してください。`)
      return
    }

    setSaving(true)
    try {
      const normalizedRecord = Object.fromEntries(
        activeConfig.fields.map((field) => [field, normalizeText(recordDraft[field])])
      )
      const errors = validateRecord(
        activeConfig,
        normalizedRecord,
        activeRows,
        recordDialogMode === "edit" ? editingRecordId : ""
      )
      if (errors.length) {
        toast.error(errors[0])
        return
      }

      if (recordDialogMode === "create") {
        await createDynamicMasterDataRecord(activeConfig, normalizedRecord)
      } else {
        await updateDynamicMasterDataRecord(activeConfig, editingRecordId, normalizedRecord)
      }

      notifyMasterDataChanged()
      setRecordDialogOpen(false)
      await loadData()
      toast.success("マスタデータを保存しました。")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord() {
    if (!activeConfig || !deleteTarget) return
    setSaving(true)
    try {
      await deleteDynamicMasterDataRecord(activeConfig, getRecordId(activeConfig, deleteTarget))
      notifyMasterDataChanged()
      setDeleteTarget(null)
      await loadData()
      toast.success("マスタデータを削除しました。")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  async function deleteAllRecords() {
    if (!deleteAllTarget) return
    setSaving(true)
    try {
      const deletedCount = await deleteAllDynamicMasterDataRecords(deleteAllTarget)
      notifyMasterDataChanged()
      setDeleteAllTarget(null)
      await loadData()
      toast.success(`${deletedCount} 件のデータを削除しました。`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "削除に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  async function importFile(file: File) {
    if (!activeConfig) return
    setSaving(true)
    try {
      const rows = await parseImportFile(file, activeConfig)
      const validRows: DynamicMasterDataRecord[] = []
      for (const [index, row] of rows.entries()) {
        const errors = validateRecord(activeConfig, row, [...activeRows, ...validRows])
        if (errors.length) {
          toast.error(`${index + 2} 行目: ${errors[0]}`)
          return
        }
        validRows.push(row)
      }
      for (const row of validRows) {
        await createDynamicMasterDataRecord(activeConfig, row)
      }
      notifyMasterDataChanged()
      await loadData()
      toast.success(`${validRows.length} 件をインポートしました。`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "インポートに失敗しました。")
    } finally {
      setSaving(false)
      if (importInputRef.current) importInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">マスタデータ</h1>
          <p className="text-sm text-muted-foreground">
            データリスト設定に基づいてマスタデータを管理します。
          </p>
        </div>
        <Button type="button" onClick={openNewConfigDialog}>
          <Plus className="size-4" />
          データリスト追加
        </Button>
      </div>

      {loading ? (
        <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">
          読み込み中...
        </div>
      ) : configs.length ? (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-md border bg-background p-2">
            <div className="px-2 py-2 text-xs font-medium text-muted-foreground">
              データリスト
            </div>
            <div className="grid gap-1">
              {configs.map((config) => (
                <button
                  key={config.collectionName}
                  type="button"
                  onClick={() => setActiveCollection(config.collectionName)}
                  className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    activeCollection === config.collectionName
                      ? "bg-accent font-medium text-accent-foreground"
                      : "hover:bg-accent/60"
                  }`}
                >
                  <span className="block truncate">{config.displayName}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            {configs.map((config) => {
              const rows = recordsByCollection[config.collectionName] ?? []
              const search = searchByCollection[config.collectionName] ?? ""
              const visibleRows = rows.filter((row) => matchesRecordSearch(config, row, search))
              if (config.collectionName !== activeCollection) return null

              return (
                <div key={config.collectionName} className="rounded-md border bg-background">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                    <div>
                      <div className="font-medium">{config.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        データリストID: {config.collectionName} / キー項目: {getLookupKeyField(config)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditConfigDialog(config)}
                      >
                        <Pencil className="size-4" />
                        設定
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteAllTarget(config)}
                        disabled={!rows.length || saving}
                      >
                        <Trash2 className="size-4" />
                        全データ削除
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openCreateRecordDialog(config)}
                      >
                        <Plus className="size-4" />
                        追加
                      </Button>
                      <input
                        ref={config.collectionName === activeCollection ? importInputRef : undefined}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void importFile(file)
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => importInputRef.current?.click()}
                        disabled={saving}
                      >
                        インポート
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" size="sm" variant="outline">
                            エクスポート
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => exportRows(config, rows, "csv")}>
                            すべて CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportRows(config, rows, "xlsx")}>
                            すべて Excel
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={!visibleRows.length}
                            onClick={() => exportRows(config, visibleRows, "csv")}
                          >
                            検索結果 CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!visibleRows.length}
                            onClick={() => exportRows(config, visibleRows, "xlsx")}
                          >
                            検索結果 Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="border-b p-4">
                    <div className="relative max-w-md">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) =>
                          setSearchByCollection((current) => ({
                            ...current,
                            [config.collectionName]: event.target.value,
                          }))
                        }
                        className="pl-9"
                        placeholder="検索..."
                      />
                    </div>
                  </div>

                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {config.fields.map((field) => (
                            <TableHead key={field}>{field}</TableHead>
                          ))}
                          <TableHead className="w-28 text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRows.length ? (
                          visibleRows.map((record) => (
                            <TableRow key={getRecordId(config, record)}>
                              {config.fields.map((field) => (
                                <TableCell key={field} className="max-w-[260px] truncate">
                                  {normalizeText(record[field])}
                                </TableCell>
                              ))}
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openEditRecordDialog(config, record)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeleteTarget(record)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={config.fields.length + 1}
                              className="h-24 text-center text-muted-foreground"
                            >
                              データがありません。
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">
          データリスト設定がありません。
        </div>
      )}

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>データリスト設定</DialogTitle>
            <DialogDescription>
              先頭のフィールドがキー項目として使われます。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>データリストID</Label>
              <Input
                value={configDraft.collectionName}
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    collectionName: event.target.value.trim(),
                  }))
                }
                disabled={Boolean(editingConfig)}
                placeholder="ItemCodeListMAV"
              />
            </div>
            <div className="grid gap-2">
              <Label>データリスト名</Label>
              <Input
                value={configDraft.displayName}
                onChange={(event) =>
                  setConfigDraft((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="資材コード照合表 MAV"
              />
            </div>
            <div className="grid gap-2">
              <Label>フィールド</Label>
              <div className="grid gap-2">
                <div className="hidden grid-cols-[1fr_80px_100px_132px] gap-2 text-xs font-medium text-muted-foreground sm:grid">
                  <div>フィールド名</div>
                  <div>必須</div>
                  <div>重複不可</div>
                  <div />
                </div>
                {configDraft.fields.map((field, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_80px_100px_auto]">
                    <Input
                      value={field.name}
                      onChange={(event) => updateConfigField(index, event.target.value)}
                      placeholder={index === 0 ? "キー項目" : "フィールド名"}
                    />
                    <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                      <Checkbox
                        checked={Boolean(field.required)}
                        onCheckedChange={(checked) =>
                          updateConfigFieldFlag(index, "required", checked === true)
                        }
                      />
                      <span className="sm:hidden">必須</span>
                    </label>
                    <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                      <Checkbox
                        checked={Boolean(field.unique)}
                        onCheckedChange={(checked) =>
                          updateConfigFieldFlag(index, "unique", checked === true)
                        }
                      />
                      <span className="sm:hidden">重複不可</span>
                    </label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => moveConfigField(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => moveConfigField(index, 1)}
                        disabled={index === configDraft.fields.length - 1}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => removeConfigField(index)}
                        disabled={configDraft.fields.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={addConfigField}>
                <Plus className="size-4" />
                フィールド追加
              </Button>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editingConfig ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfigTarget(editingConfig)}
                  disabled={saving}
                >
                  データリスト削除
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setConfigDialogOpen(false)}>
                キャンセル
              </Button>
              <Button type="button" onClick={saveConfig} disabled={saving}>
                保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {recordDialogMode === "create" ? "マスタデータ追加" : "マスタデータ編集"}
            </DialogTitle>
            <DialogDescription>
              {activeConfig
                ? `${getLookupKeyField(activeConfig)} はキー項目です。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {activeConfig ? (
            <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1">
              {activeConfig.fields.map((field) => (
                <div key={field} className="grid gap-2">
                  <Label>
                    {field}
                    {field === getLookupKeyField(activeConfig) ? " (キー項目)" : ""}
                  </Label>
                  <Input
                    value={normalizeText(recordDraft[field])}
                    onChange={(event) =>
                      setRecordDraft((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    disabled={recordDialogMode === "edit" && field === getLookupKeyField(activeConfig)}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecordDialogOpen(false)}>
              キャンセル
            </Button>
            <Button type="button" onClick={saveRecord} disabled={saving}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteConfigTarget)}
        onOpenChange={(open) => !open && setDeleteConfigTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>データリストを削除しますか。</AlertDialogTitle>
            <AlertDialogDescription>
              画面の一覧からこのデータリストを削除します。登録済みのデータは削除されません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={deleteConfig}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteAllTarget)}
        onOpenChange={(open) => !open && setDeleteAllTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>全データを削除しますか。</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAllTarget?.displayName ?? "選択中のデータリスト"} に登録されている全データを削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAllRecords}>全データ削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>マスタデータを削除しますか。</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は元に戻せません。選択したデータを削除します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRecord}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
