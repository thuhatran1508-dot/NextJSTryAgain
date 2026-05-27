import { z } from "zod"

export const itemCodeListSchema = z.object({
  id: z.string(),
  MAVCode: z.string(),
  MHBCode: z.string(),
  IzuyoshiJPCode: z.string(),
  IzuyoshiVNCode: z.string(),
  Description: z.string(),
})

export type ItemCodeList = z.infer<typeof itemCodeListSchema>
