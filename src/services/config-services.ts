"use client"

import { createFirestoreCrudService } from "@/lib/firebase/firestore-crud-service"
import {
  FIRESTORE_COLLECTIONS,
  type FixedValueConfig,
  type FixedValueConfigHistory,
  type ImportMappingConfig,
} from "@/types/firestore-models"

export const fixedValueConfigService = createFirestoreCrudService<FixedValueConfig>(
  FIRESTORE_COLLECTIONS.fixedValueConfigs,
  {
    getDocumentId: (record) => record.id,
    orderByField: "targetColumn",
  }
)

export const fixedValueConfigHistoryService =
  createFirestoreCrudService<FixedValueConfigHistory>(
    FIRESTORE_COLLECTIONS.fixedValueConfigHistory,
    {
      getDocumentId: (record) =>
        record.id ||
        `${record.configId}_${Date.now()}`,
      orderByField: "changedAt",
    }
  )

export const importMappingConfigService = createFirestoreCrudService<ImportMappingConfig>(
  FIRESTORE_COLLECTIONS.importMappingConfigs,
  {
    getDocumentId: (record) => record.id,
    orderByField: "id",
  }
)

export const configServices = {
  fixedValueConfigs: fixedValueConfigService,
  fixedValueConfigHistory: fixedValueConfigHistoryService,
  importMappingConfigs: importMappingConfigService,
}
