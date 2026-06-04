"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Maximize2,
  Plus,
  RefreshCw,
  Save,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { mappingConfigRepository } from "@/modules/import-mapping/services/import-mapping-services"
import {
  getCsvColumnIndex,
  sortMappingEntries,
} from "@/modules/import-mapping/services/import-mapping-types"
import type {
  CsvColumnLetter,
  ImportMappingConfig,
} from "@/types/firestore-models"

import {
  buildCsvRowsFromMapping,
  createMissingMasterDataRecord,
  downloadCsv,
  exportRowsToCsv,
  loadMasterDataStore,
  readExcelByMapping,
  validateCsvRows,
} from "../services/csv-create-services"
import type {
  CsvDisplayMode,
  CsvManualInput,
  CsvValidationIssue,
  CsvWorkingRow,
  ExcelImportResult,
} from "../services/csv-create-types"
import { getCellKey, getEntryColumns } from "../services/csv-create-types"

function isMappingUsable(mapping: ImportMappingConfig) {
  return (
    mapping.active &&
    !mapping.deleted &&
    Number.isInteger(mapping.startDetailRow) &&
    mapping.startDetailRow > 0 &&
    /^[A-Z]{1,3}$/i.test(mapping.validRowColumn ?? "") &&
    mapping.entries.length > 0
  )
}

function getOutputColumns(mapping: ImportMappingConfig | null) {
  if (!mapping) return []
  const columns = new Set<CsvColumnLetter>()
  sortMappingEntries(mapping.entries).forEach((entry) => {
    getEntryColumns(entry).forEach((column) => columns.add(column))
  })
  return [...columns].sort((a, b) => getCsvColumnIndex(a) - getCsvColumnIndex(b))
}

function getColumnEntry(mapping: ImportMappingConfig, column: CsvColumnLetter) {
  return sortMappingEntries(mapping.entries).find((entry) => getEntryColumns(entry).includes(column))
}

function getColumnLabel(mapping: ImportMappingConfig, column: CsvColumnLetter) {
  const entry = getColumnEntry(mapping, column)
  return entry?.targetColumnName ? `${column} ${entry.targetColumnName}` : column
}

function getVisibleColumns(mapping: ImportMappingConfig | null, displayMode: CsvDisplayMode) {
  const columns = getOutputColumns(mapping)
  if (!mapping || displayMode === "full") return columns

  return columns.filter((column) => {
    const entry = getColumnEntry(mapping, column)
    return !entry?.hideInCompactView
  })
}

function issueKey(issue: CsvValidationIssue) {
  return issue.rowId && issue.csvColumn ? getCellKey(issue.rowId, issue.csvColumn) : ""
}

function getIssueSummary(issues: CsvValidationIssue[]) {
  return {
    total: issues.length,
    lookup: issues.filter((issue) => issue.issueType === "masterLookup").length,
    format: issues.filter((issue) => issue.issueType === "format").length,
    missing: issues.filter((issue) =>
      ["sourceMissing", "required", "manualInput"].includes(issue.issueType)
    ).length,
  }
}

function cloneRows(rows: CsvWorkingRow[]) {
  return rows.map((row) => ({
    ...row,
    values: Object.fromEntries(
      Object.entries(row.values).map(([column, cell]) => [
        column,
        cell ? { ...cell, issueTypes: cell.issueTypes ? [...cell.issueTypes] : undefined } : cell,
      ])
    ) as CsvWorkingRow["values"],
  }))
}

function removeResolvedCellIssues(rows: CsvWorkingRow[], issues: CsvValidationIssue[]) {
  const valueByKey = new Map<string, string>()
  rows.forEach((row) => {
    Object.values(row.values).forEach((cell) => {
      if (cell) valueByKey.set(getCellKey(row.id, cell.column), cell.value)
    })
  })

  return issues.filter((issue) => {
    const key = issueKey(issue)
    if (!key) return true
    const value = valueByKey.get(key)
    if (!String(value ?? "").trim()) return true
    return !["sourceMissing", "required", "format"].includes(issue.issueType)
  })
}

function makeExportName(sourceFileName?: string) {
  const baseName = sourceFileName?.replace(/\.[^.]+$/, "") || "csv-export"
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `${baseName}-${stamp}.csv`
}

export function CsvCreatePageContent() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [mappings, setMappings] = useState<ImportMappingConfig[]>([])
  const [selectedMappingId, setSelectedMappingId] = useState("")
  const [mappingLoading, setMappingLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [displayMode, setDisplayMode] = useState<CsvDisplayMode>("full")
  const [rows, setRows] = useState<CsvWorkingRow[]>([])
  const [draftRows, setDraftRows] = useState<CsvWorkingRow[]>([])
  const [issues, setIssues] = useState<CsvValidationIssue[]>([])
  const [manualInputs, setManualInputs] = useState<CsvManualInput[]>([])
  const [manualValues, setManualValues] = useState<Record<string, string>>({})
  const [sourceFileName, setSourceFileName] = useState("")
  const [lastExcel, setLastExcel] = useState<ExcelImportResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const selectedMapping = useMemo(
    () => mappings.find((mapping) => mapping.id === selectedMappingId) ?? null,
    [mappings, selectedMappingId]
  )
  const visibleColumns = useMemo(
    () => getVisibleColumns(selectedMapping, displayMode),
    [selectedMapping, displayMode]
  )
  const issueSummary = useMemo(() => getIssueSummary(issues), [issues])
  const issueByCell = useMemo(() => {
    const map = new Map<string, CsvValidationIssue[]>()
    issues.forEach((issue) => {
      const key = issueKey(issue)
      if (!key) return
      map.set(key, [...(map.get(key) ?? []), issue])
    })
    return map
  }, [issues])

  useEffect(() => {
    let mounted = true
    setMappingLoading(true)
    mappingConfigRepository
      .list()
      .then((items) => {
        if (!mounted) return
        setMappings(items)
        const firstUsable = items.find(isMappingUsable)
        if (firstUsable) setSelectedMappingId(firstUsable.id)
      })
      .catch(() => toast.error("マッピングを読み込めませんでした。"))
      .finally(() => {
        if (mounted) setMappingLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  async function rebuildWithManualValues(nextManualValues = manualValues) {
    if (!selectedMapping || !lastExcel) return
    setProcessing(true)
    try {
      const nextMasterData = await loadMasterDataStore()
      const result = buildCsvRowsFromMapping({
        mapping: selectedMapping,
        excel: lastExcel,
        masterData: nextMasterData,
        manualInputs: nextManualValues,
      })
      const nextIssues = validateCsvRows(result.rows, result.issues)
      setRows(result.rows)
      setDraftRows(cloneRows(result.rows))
      setIssues(nextIssues)
      setManualInputs(result.manualInputs)
      setHasUnsavedChanges(false)
      toast.success("再処理しました。")
    } catch {
      toast.error("再処理に失敗しました。")
    } finally {
      setProcessing(false)
    }
  }

  async function handleFile(file: File) {
    if (!selectedMapping) {
      toast.error("マッピングを選択してください。")
      return
    }
    if (!isMappingUsable(selectedMapping)) {
      toast.error("このマッピングは使用できません。設定を確認してください。")
      return
    }

    setProcessing(true)
    try {
      const [excel, nextMasterData] = await Promise.all([
        readExcelByMapping(file, selectedMapping),
        loadMasterDataStore(),
      ])
      const result = buildCsvRowsFromMapping({
        mapping: selectedMapping,
        excel,
        masterData: nextMasterData,
        manualInputs: manualValues,
      })
      const nextIssues = validateCsvRows(result.rows, result.issues)
      setLastExcel(excel)
      setSourceFileName(file.name)
      setRows(result.rows)
      setDraftRows(cloneRows(result.rows))
      setIssues(nextIssues)
      setManualInputs(result.manualInputs)
      setHasUnsavedChanges(false)
      toast.success("インポートしました。")
    } catch {
      toast.error("ファイルを読み込めませんでした。")
    } finally {
      setProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function updateCell(rowId: string, column: CsvColumnLetter, value: string) {
    setDraftRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) return row
        const currentCell = row.values[column]
        return {
          ...row,
          values: {
            ...row.values,
            [column]: {
              column,
              columnName: currentCell?.columnName ?? column,
              value,
              rawValue: value,
              source: currentCell?.source ?? "manualInput",
              mappingEntryId: currentCell?.mappingEntryId,
              edited: true,
              issueTypes: currentCell?.issueTypes,
            },
          },
        }
      })
    )
    setHasUnsavedChanges(true)
  }

  function saveEdits() {
    const nextRows = cloneRows(draftRows)
    const cleanedIssues = removeResolvedCellIssues(nextRows, issues)
    const nextIssues = validateCsvRows(nextRows, cleanedIssues)
    setRows(nextRows)
    setDraftRows(cloneRows(nextRows))
    setIssues(nextIssues)
    setHasUnsavedChanges(false)
    toast.success("変更を保存しました。")
  }

  function discardEdits() {
    setDraftRows(cloneRows(rows))
    setHasUnsavedChanges(false)
    toast.info("変更を破棄しました。")
  }

  function exportCsv() {
    if (!selectedMapping || !rows.length) {
      toast.error("エクスポートするデータがありません。")
      return
    }
    if (hasUnsavedChanges) {
      const shouldContinue = window.confirm("未保存の変更があります。保存せずにエクスポートしますか。")
      if (!shouldContinue) return
    }
    if (issues.length) {
      const shouldContinue = window.confirm(
        `未解決の警告が${issues.length}件あります。空欄を含むCSVを出力しますか。`
      )
      if (!shouldContinue) return
    }

    const csv = exportRowsToCsv(rows, selectedMapping, { bom: true })
    downloadCsv(csv, makeExportName(sourceFileName))
    toast.success("CSVをエクスポートしました。")
  }

  async function addMissingMasterData(issue: CsvValidationIssue) {
    if (!issue.missingMasterDataType || !issue.sourceValue) return
    const shouldAdd = window.confirm(
      `${issue.missingMasterDataType} に「${issue.sourceValue}」を追加しますか。`
    )
    if (!shouldAdd) return
    setProcessing(true)
    try {
      await createMissingMasterDataRecord(issue.missingMasterDataType, issue.sourceValue)
      toast.success("マスタデータを追加しました。")
      await rebuildWithManualValues()
    } catch {
      toast.error("マスタデータを追加できませんでした。")
      setProcessing(false)
    }
  }

  const table = selectedMapping ? (
    <CsvWorkingTable
      mapping={selectedMapping}
      rows={draftRows}
      columns={visibleColumns}
      issueByCell={issueByCell}
      onChangeCell={updateCell}
      expanded={isExpanded}
    />
  ) : null

  return (
    <div className="flex flex-col gap-4 px-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CSV作成</h1>
          <p className="text-sm text-muted-foreground">
            マッピングを選択して注文ファイルからCSVを作成します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={displayMode === "compact" ? "default" : "outline"}
            onClick={() => setDisplayMode("compact")}
            disabled={!rows.length}
          >
            <EyeOff className="size-4" />
            簡易表示
          </Button>
          <Button
            type="button"
            variant={displayMode === "full" ? "default" : "outline"}
            onClick={() => setDisplayMode("full")}
            disabled={!rows.length}
          >
            <Eye className="size-4" />
            全項目表示
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsExpanded(true)} disabled={!rows.length}>
            <Maximize2 className="size-4" />
            大きく表示
          </Button>
          <Button type="button" variant="outline" onClick={discardEdits} disabled={!hasUnsavedChanges}>
            <X className="size-4" />
            変更を破棄
          </Button>
          <Button type="button" onClick={saveEdits} disabled={!hasUnsavedChanges}>
            <Save className="size-4" />
            保存
          </Button>
          <Button type="button" onClick={exportCsv} disabled={!rows.length}>
            <Download className="size-4" />
            CSV出力
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border bg-background p-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <div className="grid gap-2">
          <Label>マッピング</Label>
          <Select
            value={selectedMappingId}
            onValueChange={(value) => {
              if (hasUnsavedChanges) {
                const shouldChange = window.confirm("未保存の変更を破棄してマッピングを変更しますか。")
                if (!shouldChange) return
              }
              setSelectedMappingId(value)
              setRows([])
              setDraftRows([])
              setIssues([])
              setLastExcel(null)
              setSourceFileName("")
              setHasUnsavedChanges(false)
            }}
            disabled={mappingLoading || processing}
          >
            <SelectTrigger>
              <SelectValue placeholder="マッピングを選択" />
            </SelectTrigger>
            <SelectContent>
              {mappings.map((mapping) => (
                <SelectItem key={mapping.id} value={mapping.id} disabled={!isMappingUsable(mapping)}>
                  {mapping.name}
                  {!isMappingUsable(mapping) ? "（使用不可）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>注文ファイル</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
              disabled={!selectedMapping || processing}
              className="max-w-xl"
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={processing}>
              <Upload className="size-4" />
              アップロード
            </Button>
            <Button type="button" variant="outline" onClick={() => void rebuildWithManualValues()} disabled={!lastExcel || processing}>
              <RefreshCw className="size-4" />
              再処理
            </Button>
          </div>
        </div>
      </div>

      {manualInputs.length ? (
        <div className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-3">
          {manualInputs.map((manualInput) => (
            <div key={manualInput.entryId} className="grid gap-2">
              <Label>{manualInput.label}</Label>
              <Input
                value={manualValues[manualInput.entryId] ?? manualInput.value}
                onChange={(event) => {
                  const nextValues = {
                    ...manualValues,
                    [manualInput.entryId]: event.target.value,
                  }
                  setManualValues(nextValues)
                }}
                onBlur={() => void rebuildWithManualValues()}
                placeholder="値を入力"
              />
            </div>
          ))}
        </div>
      ) : null}

      <StatusPanel
        sourceFileName={sourceFileName}
        rowCount={rows.length}
        summary={issueSummary}
        processing={processing}
      />

      {issues.length ? (
        <ValidationPanel issues={issues} onAddMasterData={(issue) => void addMissingMasterData(issue)} />
      ) : null}

      <div className="min-h-96 rounded-md border bg-background">
        {rows.length ? (
          table
        ) : (
          <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
            <FileSpreadsheet className="size-10" />
            <div>マッピングを選択して注文ファイルをアップロードしてください。</div>
          </div>
        )}
      </div>

      {isExpanded && selectedMapping ? (
        <div className="fixed inset-4 z-50 flex flex-col rounded-md border bg-background shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div className="font-medium">CSVプレビュー</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={displayMode === "compact" ? "default" : "outline"} onClick={() => setDisplayMode("compact")}>
                <EyeOff className="size-4" />
                簡易表示
              </Button>
              <Button size="sm" variant={displayMode === "full" ? "default" : "outline"} onClick={() => setDisplayMode("full")}>
                <Eye className="size-4" />
                全項目表示
              </Button>
              <Button size="sm" variant="outline" onClick={discardEdits} disabled={!hasUnsavedChanges}>
                <X className="size-4" />
                変更を破棄
              </Button>
              <Button size="sm" onClick={saveEdits} disabled={!hasUnsavedChanges}>
                <Save className="size-4" />
                保存
              </Button>
              <Button size="sm" onClick={exportCsv}>
                <Download className="size-4" />
                CSV出力
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsExpanded(false)}>
                <X className="size-4" />
                閉じる
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">{table}</div>
        </div>
      ) : null}
    </div>
  )
}

function StatusPanel({
  sourceFileName,
  rowCount,
  summary,
  processing,
}: {
  sourceFileName: string
  rowCount: number
  summary: ReturnType<typeof getIssueSummary>
  processing: boolean
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-background p-4 text-sm md:grid-cols-5">
      <StatusItem label="ファイル" value={sourceFileName || "-"} />
      <StatusItem label="行数" value={rowCount ? `${rowCount}行` : "-"} />
      <StatusItem label="警告" value={`${summary.total}件`} />
      <StatusItem label="マスタ未登録" value={`${summary.lookup}件`} />
      <StatusItem label="状態" value={processing ? "処理中" : rowCount ? "確認中" : "未処理"} />
    </div>
  )
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  )
}

function ValidationPanel({
  issues,
  onAddMasterData,
}: {
  issues: CsvValidationIssue[]
  onAddMasterData: (issue: CsvValidationIssue) => void
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="mb-3 flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" />
        確認が必要なデータがあります
      </div>
      <div className="max-h-52 overflow-auto rounded-md border bg-background">
        {issues.slice(0, 80).map((issue) => (
          <div
            key={issue.id}
            className="grid gap-2 border-b p-3 last:border-b-0 md:grid-cols-[80px_100px_minmax(0,1fr)_auto]"
          >
            <div>{issue.rowNumber ? `${issue.rowNumber}行` : "-"}</div>
            <div>{issue.csvColumn ?? "-"}</div>
            <div className="min-w-0">
              <div className="truncate">{issue.message}</div>
              {issue.suggestedAction ? (
                <div className="truncate text-xs text-muted-foreground">{issue.suggestedAction}</div>
              ) : null}
            </div>
            {issue.missingMasterDataType && issue.sourceValue ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onAddMasterData(issue)}>
                <Plus className="size-4" />
                マスタ追加
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function CsvWorkingTable({
  mapping,
  rows,
  columns,
  issueByCell,
  onChangeCell,
  expanded,
}: {
  mapping: ImportMappingConfig
  rows: CsvWorkingRow[]
  columns: CsvColumnLetter[]
  issueByCell: Map<string, CsvValidationIssue[]>
  onChangeCell: (rowId: string, column: CsvColumnLetter, value: string) => void
  expanded: boolean
}) {
  return (
    <div className={expanded ? "h-full overflow-auto" : "max-h-[68vh] overflow-auto"}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-20 border-b border-r bg-muted px-3 py-2 text-left font-medium">
              行
            </th>
            {columns.map((column) => (
              <th
                key={column}
                className="sticky top-0 z-20 min-w-44 border-b border-r bg-muted px-3 py-2 text-left font-medium"
              >
                <div className="truncate">{getColumnLabel(mapping, column)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="sticky left-0 z-10 border-b border-r bg-background px-3 py-2 text-muted-foreground">
                {row.rowNumber}
              </td>
              {columns.map((column) => {
                const cell = row.values[column]
                const cellIssues = issueByCell.get(getCellKey(row.id, column)) ?? []
                const hasIssue = cellIssues.length > 0
                return (
                  <td
                    key={`${row.id}-${column}`}
                    className={[
                      "border-b border-r p-0",
                      hasIssue ? "bg-amber-100/70 dark:bg-amber-950/40" : "",
                      cell?.edited ? "bg-sky-50 dark:bg-sky-950/30" : "",
                    ].join(" ")}
                    title={cellIssues.map((issue) => issue.message).join("\n")}
                  >
                    <input
                      value={cell?.value ?? ""}
                      onChange={(event) => onChangeCell(row.id, column, event.target.value)}
                      className="h-9 w-full min-w-44 bg-transparent px-3 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring"
                      aria-label={`${getColumnLabel(mapping, column)} ${row.rowNumber}行`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
