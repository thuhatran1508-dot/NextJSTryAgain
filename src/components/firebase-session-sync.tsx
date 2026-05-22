"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { signInWithCustomToken, signOut as firebaseSignOut } from "firebase/auth"
import { auth } from "@/lib/firebase/client"

export function FirebaseSessionSync({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()

  React.useEffect(() => {
    const syncAuth = async () => {
      if (status === "authenticated" && session?.firebaseToken) {
        const currentUser = auth.currentUser
        // Only trigger client-side Firebase Auth sign-in if the user is not signed in
        // or if they are signed in as a different user.
        if (!currentUser || currentUser.uid !== session.user.id) {
          try {
            await signInWithCustomToken(auth, session.firebaseToken)
            console.log("Firebase Client SDK successfully authenticated via Custom Token.")
          } catch (error) {
            console.error("Failed to sync Firebase Client SDK with NextAuth session:", error)
          }
        }
      } else if (status === "unauthenticated") {
        // If the user logs out from NextAuth, ensure they are also logged out from Firebase Client
        if (auth.currentUser) {
          try {
            await firebaseSignOut(auth)
            console.log("Firebase Client SDK successfully logged out.")
          } catch (error) {
            console.error("Failed to sign out Firebase Client SDK:", error)
          }
        }
      }
    }

    syncAuth()
  }, [session, status])

  return <>{children}</>
}
