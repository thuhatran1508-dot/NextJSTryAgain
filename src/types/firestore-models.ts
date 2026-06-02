export const FIRESTORE_COLLECTIONS = {
  cusCodeList: "CusCodeList",
  itemCodeList: "ItemCodeList",
  unitPriceList: "UnitPriceList",
  picWhCodeList: "PIC.WH.CodeList",
  unitCodeList: "UnitCodeList",
  fixedValueConfigs: "fixedValueConfigs",
  fixedValueConfigHistory: "fixedValueConfigHistory",
  importMappingConfigs: "importMappingConfigs",
  importBatches: "importBatches",
  importBatchRows: "importBatchRows",
  validationIssues: "validationIssues",
  exportHistory: "exportHistory",
} as const

export type FirestoreCollectionName =
  (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS]

export type CustomerRule = "MHB" | "MAV"
export type BatchStatus =
  | "imported"
  | "rules_applied"
  | "needs_review"
  | "needs_master_data"
  | "validated_complete"
  | "exported_complete"
  | "exported_with_missing_data"

export type ValidationSeverity = "error" | "warning" | "info"
export type MissingMasterDataType =
  | "CusCodeList"
  | "ItemCodeList"
  | "UnitPriceList"
  | "PIC.WH.CodeList"
  | "UnitCodeList"

export type ImportMappingSourceType =
  | "sheetCell"
  | "detailColumn"
  | "expression"
  | "generated"

export type CsvColumnLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z"
  | "AA"
  | "AB"
  | "AC"
  | "AD"
  | "AE"
  | "AF"
  | "AG"
  | "AH"
  | "AI"
  | "AJ"
  | "AK"
  | "AL"
  | "AM"
  | "AN"
  | "AO"
  | "AP"
  | "AQ"

export interface AuditFields {
  createdAt?: unknown
  createdBy?: string
  updatedAt?: unknown
  updatedBy?: string
}

export interface CusCodeListRecord extends AuditFields {
  id?: string
  documentId: string
  baseDocumentId: string
  CusCode: string
  CusNameEng: string
  CusNameJP: string
  CusAddress: string
  "CusName(Eng)"?: string
  "CusName(JP)"?: string
}

export interface ItemCodeListRecord extends AuditFields {
  id?: string
  documentId: string
  baseDocumentId: string
  Description: string
  MAVCode: string
  MHBCode: string
  IzuyoshiJPCode: string
  IzuyoshiVNCode: string
}

export interface UnitPriceListRecord extends AuditFields {
  id?: string
  documentId: string
  baseDocumentId: string
  IzuyoshiJPCode: string
  UnitPrice: number | string
}

export interface PicWhCodeListRecord extends AuditFields {
  id?: string
  documentId: string
  baseDocumentId: string
  PICCode: string
  WarehouseCode: string
  DetailWarehouseCode: string
  "P.I.CCode"?: string
}

export interface UnitCodeListRecord extends AuditFields {
  id?: string
  documentId: string
  baseDocumentId: string
  OrderUnit: string
  CsvCode: string
}

export type MasterDataRecord =
  | CusCodeListRecord
  | ItemCodeListRecord
  | UnitPriceListRecord
  | PicWhCodeListRecord
  | UnitCodeListRecord

export interface FixedValueConfig extends AuditFields {
  id: string
  sourceCell: string
  targetColumn: CsvColumnLetter
  itemName: string
  defaultValue: string
  description: string
  customerRule?: CustomerRule | "ALL"
  active: boolean
}

export interface FixedValueConfigHistory extends AuditFields {
  id?: string
  configId: string
  sourceCell: string
  targetColumn: CsvColumnLetter
  oldValue: string
  newValue: string
  changedAt: unknown
  changedBy?: string
}

export interface ImportMappingConfig extends AuditFields {
  id: string
  sourceType: ImportMappingSourceType
  sourceCell?: string
  sourceColumn?: string
  expression?: string
  generatedType?: "lineNumber"
  targetColumns: CsvColumnLetter[]
  itemName: string
  level: "sheet" | "detail" | "system"
  valueType: "string" | "number" | "date"
  outputFormat?: "yyyymmdd"
  description: string
  customerRule?: CustomerRule | "ALL"
  startDetailRow?: number
  validRowColumn?: string
  active: boolean
}

export interface ImportBatchSourceFile {
  fileName: string
  fileSize?: number
  storagePath?: string
  sheetNames?: string[]
}

export interface ImportBatch extends AuditFields {
  id: string
  batchName: string
  customerRule?: CustomerRule
  picWarehouseCode?: string
  importedBy?: string
  importedAt?: unknown
  sourceFiles: ImportBatchSourceFile[]
  totalRowsRead: number
  validRows: number
  missingRows: number
  status: BatchStatus
}

export type CsvRowValues = Partial<Record<CsvColumnLetter, string | number | null>>

export interface ImportBatchRow extends AuditFields {
  id: string
  batchId: string
  sourceFileName: string
  sourceSheetName: string
  sourceRowNumber: number
  lineNumber?: number
  values: CsvRowValues
  rawValues?: Record<string, string | number | null>
  validationStatus?: "not_validated" | "valid" | "has_issues"
}

export interface ValidationIssue extends AuditFields {
  id: string
  batchId: string
  rowId?: string
  rowNumber?: number
  csvColumn?: CsvColumnLetter
  severity: ValidationSeverity
  message: string
  missingMasterDataType?: MissingMasterDataType
  sourceValue?: string
  suggestedAction?: string
  resolved: boolean
}

export interface ExportHistory extends AuditFields {
  id: string
  batchId: string
  exportedBy?: string
  exportedAt: unknown
  fileName: string
  rowCount: number
  status: "complete" | "with_missing_data"
  missingRowCount: number
  missingCellCount: number
  missingColumns: CsvColumnLetter[]
  storagePath?: string
}
