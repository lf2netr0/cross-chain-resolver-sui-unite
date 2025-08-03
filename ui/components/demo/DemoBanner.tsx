"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Info, ExternalLink, Activity } from "lucide-react"
import { useState } from "react"

export function DemoBanner() {
  const [isExpanded, setIsExpanded] = useState(false)

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return null
  }

  return (
    <Alert className="border-orange-200 bg-orange-50 text-orange-800 mb-6">
      <Info className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
              DEMO MODE
            </Badge>
            <span className="text-sm">
              You're using the local demo environment with test networks and contracts.
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-orange-700 hover:bg-orange-100"
            >
              {isExpanded ? 'Hide' : 'Show'} Details
            </Button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-4 p-3 bg-orange-100 rounded-lg">
            <h4 className="font-medium mb-2">Demo Environment Status:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3" />
                <span>BSC Fork: </span>
                <Badge variant="secondary" className="text-xs">localhost:8545</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3" />
                <span>Sui testnet: </span>
                <Badge variant="secondary" className="text-xs">https://fullnode.testnet.sui.io</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3" />
                <span>Resolver API: </span>
                <a 
                  href="http://localhost:3000/status" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                >
                  localhost:3000
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-orange-200">
              <p className="text-xs text-orange-600">
                💡 Use the pre-funded demo accounts to test cross-chain swaps without real funds.
              </p>
            </div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
