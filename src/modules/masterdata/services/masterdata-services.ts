import { getFirestoreCollection } from "@/lib/firebase/firestore-query"
import { getFirestoreSafe } from "@/lib/firebase/client"
import {
  createFirestoreCrudService,
  makeSafeDocumentId,
} from "@/lib/firebase/firestore-crud-service"

export type CusCodeListItem = {
  id?: string
  CusCode: string
  CusNameEng?: string
  CusNameJP?: string
  CusAddress?: string
}

export type ItemCodeListItem = {
  id?: string
  MAVCode?: string
  MHBCode?: string
  IzuyoshiJPCode: string
  IzuyoshiVNCode?: string
  Description?: string
}

export type UnitPriceListItem = {
  id?: string
  IzuyoshiJPCode: string
  UnitPrice?: string
}

export type PICWHCodeListItem = {
  id?: string
  PICCode: string
  WarehouseCode?: string
  DetailWarehouseCode?: string
}

export type UnitCodeListItem = {
  id?: string
  OrderUnit: string
  CsvCode?: string
}

const emptyCusCodeData: CusCodeListItem[] = []
const emptyItemCodeData: ItemCodeListItem[] = []
const emptyUnitPriceData: UnitPriceListItem[] = []
const emptyPicWhData: PICWHCodeListItem[] = []
const emptyUnitCodeData: UnitCodeListItem[] = []

export async function getCusCodeList(): Promise<CusCodeListItem[]> {
  return getFirestoreCollection<CusCodeListItem>("CusCodeList", emptyCusCodeData)
}

export async function getItemCodeList(): Promise<ItemCodeListItem[]> {
  return getFirestoreCollection<ItemCodeListItem>("ItemCodeList", emptyItemCodeData)
}

export async function getUnitPriceList(): Promise<UnitPriceListItem[]> {
  return getFirestoreCollection<UnitPriceListItem>("UnitPriceList", emptyUnitPriceData)
}

export async function getPICWHCodeList(): Promise<PICWHCodeListItem[]> {
  return getFirestoreCollection<PICWHCodeListItem>("PIC.WH.CodeList", emptyPicWhData)
}

export async function getUnitCodeList(): Promise<UnitCodeListItem[]> {
  return getFirestoreCollection<UnitCodeListItem>("UnitCodeList", emptyUnitCodeData)
}

const cusCodeCrud = createFirestoreCrudService<CusCodeListItem>("CusCodeList")
const itemCodeCrud = createFirestoreCrudService<ItemCodeListItem>("ItemCodeList")
const unitPriceCrud = createFirestoreCrudService<UnitPriceListItem>("UnitPriceList")
const picWhCrud = createFirestoreCrudService<PICWHCodeListItem>("PIC.WH.CodeList")
const unitCodeCrud = createFirestoreCrudService<UnitCodeListItem>("UnitCodeList")

export async function createCusCodeList(item: CusCodeListItem): Promise<CusCodeListItem> {
  const normalizedId = makeSafeDocumentId(item.CusCode)
  return cusCodeCrud.create({ ...item, CusCode: item.CusCode.trim() }, normalizedId)
}

export async function updateCusCodeList(item: CusCodeListItem): Promise<CusCodeListItem> {
  if (!item.id) throw new Error("CusCodeList item ID is missing.")
  await cusCodeCrud.update(item.id, {
    CusCode: item.CusCode.trim(),
    CusNameEng: item.CusNameEng?.trim(),
    CusNameJP: item.CusNameJP?.trim(),
    CusAddress: item.CusAddress?.trim(),
  })
  return item
}

export async function deleteCusCodeList(itemId: string): Promise<void> {
  await cusCodeCrud.delete(itemId)
}

export async function createItemCodeList(item: ItemCodeListItem): Promise<ItemCodeListItem> {
  const generatedId = makeSafeDocumentId(`${item.IzuyoshiJPCode}-${Date.now()}`)
  return itemCodeCrud.create({ ...item, IzuyoshiJPCode: item.IzuyoshiJPCode.trim() }, generatedId)
}

export async function updateItemCodeList(item: ItemCodeListItem): Promise<ItemCodeListItem> {
  if (!item.id) throw new Error("ItemCodeList item ID is missing.")
  await itemCodeCrud.update(item.id, {
    MAVCode: item.MAVCode?.trim(),
    MHBCode: item.MHBCode?.trim(),
    IzuyoshiJPCode: item.IzuyoshiJPCode.trim(),
    IzuyoshiVNCode: item.IzuyoshiVNCode?.trim(),
    Description: item.Description?.trim(),
  })
  return item
}

export async function deleteItemCodeList(itemId: string): Promise<void> {
  await itemCodeCrud.delete(itemId)
}

export async function createUnitPriceList(item: UnitPriceListItem): Promise<UnitPriceListItem> {
  const normalizedId = makeSafeDocumentId(item.IzuyoshiJPCode)
  return unitPriceCrud.create({ ...item, IzuyoshiJPCode: item.IzuyoshiJPCode.trim() }, normalizedId)
}

export async function updateUnitPriceList(item: UnitPriceListItem): Promise<UnitPriceListItem> {
  if (!item.id) throw new Error("UnitPriceList item ID is missing.")
  await unitPriceCrud.update(item.id, {
    IzuyoshiJPCode: item.IzuyoshiJPCode.trim(),
    UnitPrice: item.UnitPrice?.trim(),
  })
  return item
}

export async function deleteUnitPriceList(itemId: string): Promise<void> {
  await unitPriceCrud.delete(itemId)
}

export async function createPICWHCodeList(item: PICWHCodeListItem): Promise<PICWHCodeListItem> {
  const normalizedId = makeSafeDocumentId(item.PICCode)
  return picWhCrud.create({ ...item, PICCode: item.PICCode.trim() }, normalizedId)
}

export async function updatePICWHCodeList(item: PICWHCodeListItem): Promise<PICWHCodeListItem> {
  if (!item.id) throw new Error("PIC.WH.CodeList item ID is missing.")
  await picWhCrud.update(item.id, {
    PICCode: item.PICCode.trim(),
    WarehouseCode: item.WarehouseCode?.trim(),
    DetailWarehouseCode: item.DetailWarehouseCode?.trim(),
  })
  return item
}

export async function deletePICWHCodeList(itemId: string): Promise<void> {
  await picWhCrud.delete(itemId)
}

export async function createUnitCodeList(item: UnitCodeListItem): Promise<UnitCodeListItem> {
  const normalizedId = makeSafeDocumentId(item.OrderUnit)
  return unitCodeCrud.create({ ...item, OrderUnit: item.OrderUnit.trim() }, normalizedId)
}

export async function updateUnitCodeList(item: UnitCodeListItem): Promise<UnitCodeListItem> {
  if (!item.id) throw new Error("UnitCodeList item ID is missing.")
  await unitCodeCrud.update(item.id, {
    OrderUnit: item.OrderUnit.trim(),
    CsvCode: item.CsvCode?.trim(),
  })
  return item
}

export async function deleteUnitCodeList(itemId: string): Promise<void> {
  await unitCodeCrud.delete(itemId)
}
