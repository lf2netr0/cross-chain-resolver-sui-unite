"use client"

import { Check, ChevronDown, Globe } from "lucide-react"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Badge } from "./ui/badge"
import { useSuiNetwork, SUI_NETWORKS, SuiNetwork } from "./sui-wallet-provider"

interface SuiNetworkSwitcherProps {
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "lg"
}

export function SuiNetworkSwitcher({ 
  variant = "outline", 
  size = "sm" 
}: SuiNetworkSwitcherProps) {
  const { network, networkInfo, switchNetwork } = useSuiNetwork()

  const getNetworkColor = (networkId: SuiNetwork) => {
    switch (networkId) {
      case "mainnet":
        return "bg-green-500"
      case "testnet":
        return "bg-yellow-500"
      case "devnet":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  const getNetworkBadgeVariant = (networkId: SuiNetwork) => {
    switch (networkId) {
      case "mainnet":
        return "default" as const
      case "testnet":
        return "secondary" as const
      case "devnet":
        return "outline" as const
      default:
        return "outline" as const
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-200">
          <div className={`w-2 h-2 rounded-full ${getNetworkColor(network)}`} />
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">{networkInfo.name}</span>
          <span className="sm:hidden text-xs">
            {network.toUpperCase()}
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-slate-800 border-slate-700 text-white">
        {Object.entries(SUI_NETWORKS).map(([networkId, info]) => {
          const isSelected = network === networkId
          const typedNetworkId = networkId as SuiNetwork
          
          return (
            <DropdownMenuItem
              key={networkId}
              onClick={() => switchNetwork(typedNetworkId)}
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 focus:bg-slate-700"
            >
              <div className={`w-2 h-2 rounded-full ${getNetworkColor(typedNetworkId)}`} />
              <div className="flex-1">
                <div className="font-medium">{info.name}</div>
                <div className="text-xs text-muted-foreground">
                  {info.rpcUrl.replace("https://", "").replace(":443", "")}
                </div>
              </div>
              {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}