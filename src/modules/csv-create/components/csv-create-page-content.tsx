"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileSpreadsheet,
  GripVertical,
  LogOut,
  Maximize2,
  Plus,
  RefreshCw,
  Save,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  refreshDerivedCsvRows,
  validateCsvRows,
} from "../services/csv-create-services"
import type {
  CsvDisplayMode,
  CsvManualInput,
  CsvValidationIssue,
  CsvWorkingRow,
  ExcelImportResult,
  MasterDataLookupStore,
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

function isResolvedByCellValue(issue: CsvValidationIssue, value: string | undefined) {
  if (!String(value ?? "").trim()) return false
  return ["sourceMissing", "required", "masterLookup"].includes(issue.issueType)
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

const CSV_SESSION_STORAGE_KEY = "csv-create-working-session"
const MASTER_DATA_CHANGED_STORAGE_KEY = "master-data:changed-at"
const MIN_CSV_COLUMN_WIDTH = 72
const MAX_AUTO_CSV_COLUMN_WIDTH = 280
const DEFAULT_CSV_COLUMN_WIDTH = 136

type CsvSortDirection = "asc" | "desc"

interface CsvSortState {
  column: CsvColumnLetter
  direction: CsvSortDirection
}

interface CsvCreateSessionState {
  sessionOpen: boolean
  sessionId: string
  selectedMappingId: string
  displayMode: CsvDisplayMode
  columnWidths: Partial<Record<CsvColumnLetter, number>>
  hiddenColumns: CsvColumnLetter[]
  sortState: CsvSortState | null
  rows: CsvWorkingRow[]
  draftRows: CsvWorkingRow[]
  issues: CsvValidationIssue[]
  manualInputs: CsvManualInput[]
  manualValues: Record<string, string>
  sourceFileName: string
  lastExcel: ExcelImportResult | null
  hasUnsavedChanges: boolean
}

let inMemoryCsvSessionState: CsvCreateSessionState | null = null

function getEmptySessionState(selectedMappingId = ""): CsvCreateSessionState {
  return {
    sessionOpen: false,
    sessionId: "",
    selectedMappingId,
    displayMode: "full",
    columnWidths: {},
    hiddenColumns: [],
    sortState: null,
    rows: [],
    draftRows: [],
    issues: [],
    manualInputs: [],
    manualValues: {},
    sourceFileName: "",
    lastExcel: null,
    hasUnsavedChanges: false,
  }
}

function createSessionId() {
  return `csv-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadStoredSessionState() {
  if (inMemoryCsvSessionState?.sessionOpen) return inMemoryCsvSessionState
  if (typeof window === "undefined") return getEmptySessionState()

  try {
    const stored = window.sessionStorage.getItem(CSV_SESSION_STORAGE_KEY)
    if (!stored) return getEmptySessionState()

    const parsed = JSON.parse(stored) as Partial<CsvCreateSessionState>
    if (!parsed.sessionOpen || !parsed.sessionId) return getEmptySessionState()

    return {
      ...getEmptySessionState(),
      ...parsed,
      sessionOpen: true,
      rows: parsed.rows ?? [],
      draftRows: parsed.draftRows ?? [],
      issues: parsed.issues ?? [],
      manualInputs: parsed.manualInputs ?? [],
      manualValues: parsed.manualValues ?? {},
      columnWidths: parsed.columnWidths ?? {},
      hiddenColumns: parsed.hiddenColumns ?? [],
      sortState: parsed.sortState ?? null,
      lastExcel: parsed.lastExcel ?? null,
    }
  } catch {
    return getEmptySessionState()
  }
}

function storeSessionState(state: CsvCreateSessionState) {
  inMemoryCsvSessionState = state.sessionOpen ? state : null
  if (typeof window === "undefined") return

  if (!state.sessionOpen) {
    try {
      window.sessionStorage.removeItem(CSV_SESSION_STORAGE_KEY)
    } catch {
      // Storage can be unavailable in private or quota-limited contexts.
    }
    return
  }

  const serializedState = JSON.stringify(state)
  if (serializedState.length > 2_500_000) {
    const lightweightState: CsvCreateSessionState = {
      ...state,
      rows: [],
      draftRows: [],
      issues: [],
      lastExcel: null,
    }

    try {
      window.sessionStorage.setItem(CSV_SESSION_STORAGE_KEY, JSON.stringify(lightweightState))
    } catch {
      try {
        window.sessionStorage.removeItem(CSV_SESSION_STORAGE_KEY)
      } catch {
        // The in-memory session still protects SPA navigation.
      }
    }
    return
  }

  try {
    window.sessionStorage.setItem(CSV_SESSION_STORAGE_KEY, serializedState)
  } catch {
    const lightweightState: CsvCreateSessionState = {
      ...state,
      rows: [],
      draftRows: [],
      issues: [],
      lastExcel: null,
    }

    try {
      window.sessionStorage.setItem(CSV_SESSION_STORAGE_KEY, JSON.stringify(lightweightState))
    } catch {
      try {
        window.sessionStorage.removeItem(CSV_SESSION_STORAGE_KEY)
      } catch {
        // Nothing else to do; the in-memory session still protects SPA navigation.
      }
    }
  }
}

export function CsvCreatePageContent() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const initialSessionRef = useRef<CsvCreateSessionState | null>(null)
  if (!initialSessionRef.current) initialSessionRef.current = loadStoredSessionState()
  const initialSession = initialSessionRef.current
  const [mappings, setMappings] = useState<ImportMappingConfig[]>([])
  const [sessionOpen, setSessionOpen] = useState(initialSession.sessionOpen)
  const [sessionId, setSessionId] = useState(initialSession.sessionId)
  const [selectedMappingId, setSelectedMappingId] = useState(initialSession.selectedMappingId)
  const [mappingLoading, setMappingLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [displayMode, setDisplayMode] = useState<CsvDisplayMode>(initialSession.displayMode)
  const [columnWidths, setColumnWidths] = useState<Partial<Record<CsvColumnLetter, number>>>(initialSession.columnWidths)
  const [hiddenColumns, setHiddenColumns] = useState<CsvColumnLetter[]>(initialSession.hiddenColumns)
  const [sortState, setSortState] = useState<CsvSortState | null>(initialSession.sortState)
  const [rows, setRows] = useState<CsvWorkingRow[]>(initialSession.rows)
  const [draftRows, setDraftRows] = useState<CsvWorkingRow[]>(initialSession.draftRows)
  const [issues, setIssues] = useState<CsvValidationIssue[]>(initialSession.issues)
  const [manualInputs, setManualInputs] = useState<CsvManualInput[]>(initialSession.manualInputs)
  const [manualValues, setManualValues] = useState<Record<string, string>>(initialSession.manualValues)
  const [sourceFileName, setSourceFileName] = useState(initialSession.sourceFileName)
  const [lastExcel, setLastExcel] = useState<ExcelImportResult | null>(initialSession.lastExcel)
  const [masterDataStore, setMasterDataStore] = useState<MasterDataLookupStore | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(initialSession.hasUnsavedChanges)

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
    const valueByKey = new Map<string, string>()
    draftRows.forEach((row) => {
      Object.values(row.values).forEach((cell) => {
        if (cell) valueByKey.set(getCellKey(row.id, cell.column), cell.value)
      })
    })

    const map = new Map<string, CsvValidationIssue[]>()
    issues.forEach((issue) => {
      const key = issueKey(issue)
      if (!key) return
      if (isResolvedByCellValue(issue, valueByKey.get(key))) return
      map.set(key, [...(map.get(key) ?? []), issue])
    })
    return map
  }, [draftRows, issues])

  useEffect(() => {
    storeSessionState({
      sessionOpen,
      sessionId,
      selectedMappingId,
      displayMode,
      columnWidths,
      hiddenColumns,
      sortState,
      rows,
      draftRows,
      issues,
      manualInputs,
      manualValues,
      sourceFileName,
      lastExcel,
      hasUnsavedChanges,
    })
  }, [
    sessionOpen,
    sessionId,
    selectedMappingId,
    displayMode,
    columnWidths,
    hiddenColumns,
    sortState,
    rows,
    draftRows,
    issues,
    manualInputs,
    manualValues,
    sourceFileName,
    lastExcel,
    hasUnsavedChanges,
  ])

  useEffect(() => {
    let mounted = true
    setMappingLoading(true)
    mappingConfigRepository
      .list()
      .then((items) => {
        if (!mounted) return
        setMappings(items)
        const firstUsable = items.find(isMappingUsable)
        if (firstUsable) setSelectedMappingId((currentId) => currentId || firstUsable.id)
      })
      .catch(() => toast.error("マッピングを読み込めませんでした。"))
      .finally(() => {
        if (mounted) setMappingLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!sessionOpen || !selectedMapping || !draftRows.length) return

    let refreshing = false
    const refreshSilently = () => {
      if (refreshing) return
      refreshing = true
      void refreshDerivedValues({ silent: true }).finally(() => {
        refreshing = false
      })
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === MASTER_DATA_CHANGED_STORAGE_KEY) refreshSilently()
    }
    const handleFocus = () => refreshSilently()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSilently()
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [draftRows.length, issues, selectedMapping, sessionOpen])

  function clearWorkingData(nextSelectedMappingId = selectedMappingId) {
    setSelectedMappingId(nextSelectedMappingId)
    setDisplayMode("full")
    setColumnWidths({})
    setHiddenColumns([])
    setSortState(null)
    setRows([])
    setDraftRows([])
    setIssues([])
    setManualInputs([])
    setManualValues({})
    setSourceFileName("")
    setLastExcel(null)
    setMasterDataStore(null)
    setIsExpanded(false)
    setHasUnsavedChanges(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function startNewSession() {
    if (sessionOpen) {
      toast.info("現在の作業セッションを閉じてから新規セッションを開始してください。")
      return
    }

    const firstUsable = mappings.find(isMappingUsable)
    setSessionOpen(true)
    setSessionId(createSessionId())
    clearWorkingData(selectedMappingId || firstUsable?.id || "")
    toast.success("新しい作業セッションを開始しました。")
  }

  function closeCurrentSession() {
    if (!sessionOpen) return
    const shouldClose = window.confirm("現在の作業セッションを閉じますか。作業中のデータは破棄されます。")
    if (!shouldClose) return

    setSessionOpen(false)
    setSessionId("")
    clearWorkingData(selectedMappingId)
    toast.info("作業セッションを閉じました。")
  }

  async function refreshDerivedValues(options: { silent?: boolean } = {}) {
    if (!sessionOpen || !selectedMapping || !draftRows.length) return
    setProcessing(true)
    try {
      const nextMasterData = await loadMasterDataStore()
      setMasterDataStore(nextMasterData)
      const refreshed = refreshDerivedCsvRows({
        rows: draftRows,
        mapping: selectedMapping,
        masterData: nextMasterData,
        existingIssues: issues,
      })
      setRows(refreshed.rows)
      setDraftRows(cloneRows(refreshed.rows))
      setIssues(refreshed.issues)
      setHasUnsavedChanges(false)
      if (!options.silent) toast.success("データを更新しました。")
    } catch {
      if (!options.silent) toast.error("データ更新に失敗しました。")
    } finally {
      setProcessing(false)
    }
  }

  async function rebuildWithManualValues(nextManualValues = manualValues) {
    if (!sessionOpen || !selectedMapping || !lastExcel) return
    setProcessing(true)
    try {
      const nextMasterData = await loadMasterDataStore()
      setMasterDataStore(nextMasterData)
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
    if (!sessionOpen) {
      toast.error("先に新規セッションを開始してください。")
      return
    }
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
      setMasterDataStore(nextMasterData)
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
    if (!sessionOpen) return
    const nextRows = draftRows.map((row) => {
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

    if (selectedMapping) {
      const refreshed = refreshDerivedCsvRows({
        rows: nextRows,
        mapping: selectedMapping,
        masterData: masterDataStore ?? {},
        existingIssues: issues,
      })
      setDraftRows(refreshed.rows)
      setIssues(refreshed.issues)
    } else {
      setDraftRows(nextRows)
    }
    setHasUnsavedChanges(true)
  }

  function saveEdits() {
    if (!sessionOpen) return
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
    if (!sessionOpen) return
    setDraftRows(cloneRows(rows))
    setHasUnsavedChanges(false)
    toast.info("変更を破棄しました。")
  }

  function exportCsv() {
    if (!sessionOpen) {
      toast.error("先に新規セッションを開始してください。")
      return
    }
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
    if (!sessionOpen) return
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
      columnWidths={columnWidths}
      hiddenColumns={hiddenColumns}
      sortState={sortState}
      issueByCell={issueByCell}
      onChangeCell={updateCell}
      onChangeColumnWidth={(column, width) => {
        setColumnWidths((currentWidths) => ({ ...currentWidths, [column]: width }))
      }}
      onToggleColumn={(column) => {
        setHiddenColumns((currentColumns) =>
          currentColumns.includes(column)
            ? currentColumns.filter((currentColumn) => currentColumn !== column)
            : [...currentColumns, column]
        )
      }}
      onChangeSort={setSortState}
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
          <Button type="button" variant="outline" onClick={startNewSession} disabled={sessionOpen || mappingLoading || processing}>
            <FilePlus2 className="size-4" />
            新規セッション
          </Button>
          <Button type="button" variant="outline" onClick={closeCurrentSession} disabled={!sessionOpen || processing}>
            <LogOut className="size-4" />
            セッション終了
          </Button>
          <Button
            type="button"
            variant={displayMode === "compact" ? "default" : "outline"}
            onClick={() => setDisplayMode("compact")}
            disabled={!sessionOpen || !rows.length}
          >
            <EyeOff className="size-4" />
            簡易表示
          </Button>
          <Button
            type="button"
            variant={displayMode === "full" ? "default" : "outline"}
            onClick={() => setDisplayMode("full")}
            disabled={!sessionOpen || !rows.length}
          >
            <Eye className="size-4" />
            全項目表示
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsExpanded(true)} disabled={!sessionOpen || !rows.length}>
            <Maximize2 className="size-4" />
            大きく表示
          </Button>
          <Button type="button" variant="outline" onClick={discardEdits} disabled={!sessionOpen || !hasUnsavedChanges}>
            <X className="size-4" />
            変更を破棄
          </Button>
          <Button type="button" onClick={saveEdits} disabled={!sessionOpen || !hasUnsavedChanges}>
            <Save className="size-4" />
            保存
          </Button>
          <Button type="button" onClick={exportCsv} disabled={!sessionOpen || !rows.length}>
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
              if (!sessionOpen) return
              if (hasUnsavedChanges) {
                const shouldChange = window.confirm("未保存の変更を破棄してマッピングを変更しますか。")
                if (!shouldChange) return
              }
              setSelectedMappingId(value)
              setRows([])
              setDraftRows([])
              setIssues([])
              setColumnWidths({})
              setHiddenColumns([])
              setSortState(null)
              setLastExcel(null)
              setSourceFileName("")
              setHasUnsavedChanges(false)
            }}
            disabled={!sessionOpen || mappingLoading || processing}
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
              disabled={!sessionOpen || !selectedMapping || processing}
              className="max-w-xl"
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!sessionOpen || processing}>
              <Upload className="size-4" />
              アップロード
            </Button>
            <Button type="button" variant="outline" onClick={() => void rebuildWithManualValues()} disabled={!sessionOpen || !lastExcel || processing}>
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
                disabled={!sessionOpen || processing}
                placeholder="値を入力"
              />
            </div>
          ))}
        </div>
      ) : null}

      <StatusPanel
        sessionOpen={sessionOpen}
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
  sessionOpen,
  sourceFileName,
  rowCount,
  summary,
  processing,
}: {
  sessionOpen: boolean
  sourceFileName: string
  rowCount: number
  summary: ReturnType<typeof getIssueSummary>
  processing: boolean
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-background p-4 text-sm md:grid-cols-6">
      <StatusItem label="セッション" value={sessionOpen ? "作業中" : "未開始"} />
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

function estimateTextWidth(value: string) {
  return Array.from(value).reduce((width, char) => {
    return width + (/[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(char) ? 14 : 7)
  }, 0)
}

function getAutoColumnWidth(mapping: ImportMappingConfig, rows: CsvWorkingRow[], column: CsvColumnLetter) {
  const headerWidth = estimateTextWidth(getColumnLabel(mapping, column))
  const contentWidth = rows.slice(0, 120).reduce((width, row) => {
    return Math.max(width, estimateTextWidth(row.values[column]?.value ?? ""))
  }, 0)

  return Math.max(
    MIN_CSV_COLUMN_WIDTH,
    Math.min(MAX_AUTO_CSV_COLUMN_WIDTH, Math.max(headerWidth, contentWidth) + 34)
  )
}

function shouldShowCellTooltip(value: string, columnWidth: number) {
  return Boolean(value.trim()) && estimateTextWidth(value) > columnWidth - 24
}

function CsvWorkingTable({
  mapping,
  rows,
  columns,
  columnWidths,
  hiddenColumns,
  sortState,
  issueByCell,
  onChangeCell,
  onChangeColumnWidth,
  onToggleColumn,
  onChangeSort,
  expanded,
}: {
  mapping: ImportMappingConfig
  rows: CsvWorkingRow[]
  columns: CsvColumnLetter[]
  columnWidths: Partial<Record<CsvColumnLetter, number>>
  hiddenColumns: CsvColumnLetter[]
  sortState: CsvSortState | null
  issueByCell: Map<string, CsvValidationIssue[]>
  onChangeCell: (rowId: string, column: CsvColumnLetter, value: string) => void
  onChangeColumnWidth: (column: CsvColumnLetter, width: number) => void
  onToggleColumn: (column: CsvColumnLetter) => void
  onChangeSort: (sortState: CsvSortState | null) => void
  expanded: boolean
}) {
  const visibleTableColumns = useMemo(
    () => columns.filter((column) => !hiddenColumns.includes(column)),
    [columns, hiddenColumns]
  )
  const effectiveColumns = visibleTableColumns.length ? visibleTableColumns : columns.slice(0, 1)
  const sortedRows = useMemo(() => {
    if (!sortState) return rows

    return [...rows].sort((a, b) => {
      const aValue = a.values[sortState.column]?.value ?? ""
      const bValue = b.values[sortState.column]?.value ?? ""
      const aNumber = Number(aValue)
      const bNumber = Number(bValue)
      const bothNumeric = aValue !== "" && bValue !== "" && Number.isFinite(aNumber) && Number.isFinite(bNumber)
      const result = bothNumeric
        ? aNumber - bNumber
        : String(aValue).localeCompare(String(bValue), "ja", { numeric: true, sensitivity: "base" })

      return sortState.direction === "asc" ? result : -result
    })
  }, [rows, sortState])
  const autoColumnWidths = useMemo(() => {
    return Object.fromEntries(
      columns.map((column) => [column, getAutoColumnWidth(mapping, rows, column)])
    ) as Partial<Record<CsvColumnLetter, number>>
  }, [columns, mapping, rows])

  function getColumnWidth(column: CsvColumnLetter) {
    return columnWidths[column] ?? autoColumnWidths[column] ?? DEFAULT_CSV_COLUMN_WIDTH
  }

  function toggleSort(column: CsvColumnLetter) {
    if (!sortState || sortState.column !== column) {
      onChangeSort({ column, direction: "asc" })
      return
    }
    if (sortState.direction === "asc") {
      onChangeSort({ column, direction: "desc" })
      return
    }
    onChangeSort(null)
  }

  function startResize(event: ReactMouseEvent<HTMLButtonElement>, column: CsvColumnLetter) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getColumnWidth(column)

    function handleMouseMove(moveEvent: MouseEvent) {
      const nextWidth = Math.max(MIN_CSV_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX)
      onChangeColumnWidth(column, Math.round(nextWidth))
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="text-xs text-muted-foreground">
          {effectiveColumns.length}/{columns.length} 列表示
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              <Columns3 className="size-4" />
              列
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 min-w-56">
            <DropdownMenuLabel>表示する列</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => {
              const checked = !hiddenColumns.includes(column)
              return (
                <DropdownMenuCheckboxItem
                  key={column}
                  checked={checked}
                  disabled={checked && effectiveColumns.length <= 1}
                  onCheckedChange={() => onToggleColumn(column)}
                >
                  <span className="max-w-44 truncate">{getColumnLabel(mapping, column)}</span>
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={expanded ? "min-h-0 flex-1 overflow-auto" : "max-h-[68vh] overflow-auto"}>
      <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col style={{ width: 64 }} />
          {effectiveColumns.map((column) => (
            <col key={column} style={{ width: getColumnWidth(column) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r bg-muted px-3 py-2 text-left font-medium">
              行
            </th>
            {effectiveColumns.map((column) => {
              const label = getColumnLabel(mapping, column)
              const activeSort = sortState?.column === column ? sortState.direction : null
              const columnWidth = getColumnWidth(column)
              return (
                <th
                  key={column}
                  className="sticky top-0 z-20 border-b border-r bg-muted p-0 text-left font-medium"
                  style={{ width: columnWidth, minWidth: MIN_CSV_COLUMN_WIDTH }}
                >
                  <div className="relative flex h-10 items-center">
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="flex h-full min-w-0 flex-1 items-center gap-1 px-3 pr-6 text-left outline-none hover:bg-accent focus:bg-accent"
                      aria-label={`${label} sort`}
                    >
                      <span className="truncate">{label}</span>
                      {activeSort === "asc" ? (
                        <ArrowUp className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : activeSort === "desc" ? (
                        <ArrowDown className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => startResize(event, column)}
                      className="absolute right-0 top-0 flex h-full w-4 cursor-col-resize items-center justify-center text-muted-foreground hover:bg-border"
                      aria-label={`${label} resize`}
                    >
                      <GripVertical className="size-3" />
                    </button>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              <td className="sticky left-0 z-10 border-b border-r bg-background px-3 py-2 text-muted-foreground">
                {row.rowNumber}
              </td>
              {effectiveColumns.map((column) => {
                const cell = row.values[column]
                const cellValue = cell?.value ?? ""
                const cellIssues = issueByCell.get(getCellKey(row.id, column)) ?? []
                const hasIssue = cellIssues.length > 0
                const columnWidth = getColumnWidth(column)
                const showFullValue = shouldShowCellTooltip(cellValue, columnWidth)
                const input = (
                  <input
                    value={cellValue}
                    onChange={(event) => onChangeCell(row.id, column, event.target.value)}
                    className="h-9 w-full truncate bg-transparent px-3 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring"
                    aria-label={`${getColumnLabel(mapping, column)} ${row.rowNumber}行`}
                  />
                )
                return (
                  <td
                    key={`${row.id}-${column}`}
                    className={[
                      "border-b border-r p-0",
                      hasIssue ? "bg-amber-100/70 dark:bg-amber-950/40" : "",
                      cell?.edited ? "bg-sky-50 dark:bg-sky-950/30" : "",
                    ].join(" ")}
                    style={{ width: columnWidth, minWidth: MIN_CSV_COLUMN_WIDTH }}
                    title={cellIssues.map((issue) => issue.message).join("\n")}
                  >
                    {showFullValue ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{input}</TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-xl whitespace-pre-wrap break-words border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
                        >
                          {cellValue}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      input
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
