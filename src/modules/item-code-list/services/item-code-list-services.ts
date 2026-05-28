"use client"

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore"

import { db } from "@/lib/firebase/client"
import { itemCodeListMockData } from "./item-code-list-mock-data"
import type { ItemCodeList } from "./types/item-code-list-types"

const ITEM_CODE_LIST_COLLECTION = "ItemCodeList"

export async function getItemCodeList(): Promise<ItemCodeList[]> {
  const snapshot = await getDocs(collection(db, ITEM_CODE_LIST_COLLECTION))

  return snapshot.docs.map((document) => {
    const data = document.data() as ItemCodeList
    // Document ID is the MAVCode (matching IzuyoshiJPCode in your data)
    return {
      ...data,
      id: document.id,
      MAVCode: document.id,
    }
  })
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
