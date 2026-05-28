"use client"

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore"

import { getFirestoreSafe } from "@/lib/firebase/client"
import { itemCodeListMockData } from "./item-code-list-mock-data"
import type { ItemCodeList } from "./types/item-code-list-types"

const ITEM_CODE_LIST_COLLECTION = "ItemCodeList"

function normalizeItem(docId: string, data: Record<string, unknown>): ItemCodeList {
  const id = (data.documentId as string) || (data.IzuyoshiJPCode as string) || docId
  let updatedAt: string | number | undefined

  if (data.updatedAt) {
    const ts = data.updatedAt as Timestamp
    if (typeof ts.toDate === "function") {
      updatedAt = ts.toDate().toISOString()
    } else {
      updatedAt = data.updatedAt as string | number
    }
  }

  return {
    id,
    documentId: (data.documentId as string) || id,
    baseDocumentId: (data.baseDocumentId as string) || id,
    MAVCode: (data.MAVCode as string) || id,
    MHBCode: (data.MHBCode as string) || "",
    IzuyoshiJPCode: (data.IzuyoshiJPCode as string) || id,
    IzuyoshiVNCode: (data.IzuyoshiVNCode as string) || "",
    Description: (data.Description as string) || "",
    updatedAt,
  }
}

export async function getItemCodeList(): Promise<ItemCodeList[]> {
  const db = getFirestoreSafe()
  if (!db) {
    console.warn("Firebase not configured. Using mock data.")
    return itemCodeListMockData
  }

  try {
    const snapshot = await getDocs(collection(db, ITEM_CODE_LIST_COLLECTION))

    if (snapshot.empty) {
      console.warn("ItemCodeList collection is empty. Using mock data.")
      return itemCodeListMockData
    }

    return snapshot.docs.map((document) =>
      normalizeItem(document.id, document.data() as Record<string, unknown>)
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const isPermissionError =
      message.includes("permission") ||
      message.includes("PERMISSION_DENIED") ||
      message.includes("insufficient")

    if (isPermissionError) {
      console.error(
        `[ItemCodeList] Permission denied when reading "${ITEM_CODE_LIST_COLLECTION}". ` +
        `Firestore security rules is blocking read access. ` +
        `Please update your Firestore rules to allow read on collection "${ITEM_CODE_LIST_COLLECTION}".`
      )
    } else {
      console.warn("Failed to load ItemCodeList from Firestore, using mock data.", error)
    }
    return itemCodeListMockData
  }
}

export async function seedItemCodeListWithClient(): Promise<ItemCodeList[]> {
  const db = getFirestoreSafe()
  if (!db) return itemCodeListMockData

  const batch = writeBatch(db)

  itemCodeListMockData.forEach((item) => {
    batch.set(doc(db, ITEM_CODE_LIST_COLLECTION, item.id), item, { merge: true })
  })

  await batch.commit()
  return getItemCodeList()
}

export async function createItemCodeList(item: ItemCodeList): Promise<ItemCodeList> {
  const db = getFirestoreSafe()
  if (!db) return item

  await setDoc(doc(db, ITEM_CODE_LIST_COLLECTION, item.id), {
    documentId: item.documentId || item.id,
    baseDocumentId: item.baseDocumentId || item.id,
    MAVCode: item.MAVCode,
    MHBCode: item.MHBCode,
    IzuyoshiJPCode: item.IzuyoshiJPCode,
    IzuyoshiVNCode: item.IzuyoshiVNCode,
    Description: item.Description,
  })
  return item
}

export async function updateItemCodeList(item: ItemCodeList): Promise<ItemCodeList> {
  const db = getFirestoreSafe()
  if (!db) return item

  await updateDoc(doc(db, ITEM_CODE_LIST_COLLECTION, item.id), {
    MHBCode: item.MHBCode,
    IzuyoshiJPCode: item.IzuyoshiJPCode,
    IzuyoshiVNCode: item.IzuyoshiVNCode,
    Description: item.Description,
  })
  return { ...item, MAVCode: item.id }
}

export async function deleteItemCodeList(itemId: string): Promise<void> {
  const db = getFirestoreSafe()
  if (!db) return

  await deleteDoc(doc(db, ITEM_CODE_LIST_COLLECTION, itemId))
}
