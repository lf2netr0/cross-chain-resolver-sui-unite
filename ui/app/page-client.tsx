"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import dynamic from "next/dynamic"
import { Suspense } from "react"

// Import components dynamically to avoid SSR issues
const SwapInterface = dynamic(() => import("@/components/swap-interface"), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md mx-auto h-[500px] bg-slate-800 border-slate-700 rounded-lg animate-pulse"></div>
  ),
})

const HomePageChart = dynamic(() => import("@/components/home-page-chart"), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-slate-800 border-slate-700 rounded-lg animate-pulse"></div>,
})

export default function HomeClient() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8">
          <div className="flex items-center justify-center">
            <Suspense
              fallback={<div className="w-full max-w-md h-[500px] bg-slate-800 rounded-lg animate-pulse"></div>}
            >
              <SwapInterface />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
