"use client"

import { Toaster } from "sileo"
import "sileo/styles.css"

export function ToastViewport() {
  return <Toaster position="top-center" offset={{ top: 24 }} />
}
