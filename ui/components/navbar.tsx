"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, Menu, X } from "lucide-react"
import { CrossChainWalletButton } from "./cross-chain-wallet-button"
import { ThemeToggle } from "./theme-toggle"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-700/50 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-teal-500">
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">M</div>
            </div>
            <span className="hidden font-bold text-xl text-white md:inline-block">MoveB</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/swap" className="text-sm font-medium text-white hover:text-cyan-300 transition-colors">
            Swap
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="text-sm font-medium text-white hover:text-cyan-300 transition-colors flex items-center gap-1 px-0"
              >
                More <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                <Link href="/about" className="w-full">
                  About
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                <Link href="/docs" className="w-full">
                  Docs
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <CrossChainWalletButton />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden absolute w-full bg-slate-800 border-b border-slate-700 py-4 px-6 space-y-4">
          <Link
            href="/swap"
            className="block text-sm font-medium text-white hover:text-cyan-300 transition-colors py-2"
            onClick={() => setIsMenuOpen(false)}
          >
            Swap
          </Link>
          <div className="py-2">
            <div className="text-sm font-medium text-white mb-2">Earn</div>
            <div className="pl-4 space-y-2">
              <Link
                href="/pools"
                className="block text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Liquidity Pools
              </Link>
              <Link
                href="/farms"
                className="block text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Farms
              </Link>
              <Link
                href="/staking"
                className="block text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Staking
              </Link>
            </div>
          </div>
          <Link
            href="/analytics"
            className="block text-sm font-medium text-white hover:text-cyan-300 transition-colors py-2"
            onClick={() => setIsMenuOpen(false)}
          >
            Analytics
          </Link>
          <div className="py-2">
            <div className="text-sm font-medium text-white mb-2">More</div>
            <div className="pl-4 space-y-2">
              <Link
                href="/about"
                className="block text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/docs"
                className="block text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Docs
              </Link>
              <Link
                href="/governance"
                className="block text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Governance
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
