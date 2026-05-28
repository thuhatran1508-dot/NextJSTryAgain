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

import { db } from "@/lib/firebase/client"
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
  try {
    const snapshot = await getDocs(collection(db, ITEM_CODE_LIST_COLLECTION))

    if (snapshot.empty) {
      return itemCodeListMockData
    }

    return snapshot.docs.map((document) =>
      normalizeItem(document.id, document.data() as Record<string, unknown>)
    )
  } catch (error) {
    console.warn("Failed to load ItemCodeList from Firestore, using mock data.", error)
    return itemCodeListMockData
  }
}

export async function seedItemCodeListWithClient(): Promise<ItemCodeList[]> {
  const batch = writeBatch(db)

  itemCodeListMockData.forEach((item) => {
    batch.set(doc(db, ITEM_CODE_LIST_COLLECTION, item.id), item, { merge: true })
  })

  await batch.commit()
  return getItemCodeList()
}

export async function createItemCodeList(item: ItemCodeList): Promise<ItemCodeList> {
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
  await updateDoc(doc(db, ITEM_CODE_LIST_COLLECTION, item.id), {
    MHBCode: item.MHBCode,
    IzuyoshiJPCode: item.IzuyoshiJPCode,
    IzuyoshiVNCode: item.IzuyoshiVNCode,
    Description: item.Description,
  })
  return { ...item, MAVCode: item.id }
}

export async function deleteItemCodeList(itemId: string): Promise<void> {
  await deleteDoc(doc(db, ITEM_CODE_LIST_COLLECTION, itemId))
}
