"use client"

import { Button } from "@/components/ui/button"
import { ArrowUpRight, CheckCircle2, Clock, XCircle } from "lucide-react"

interface Transaction {
  id: string
  type: "swap" | "approve" | "add" | "remove"
  status: "pending" | "completed" | "failed"
  timestamp: number
  fromToken: {
    symbol: string
    amount: number
  }
  toToken?: {
    symbol: string
    amount: number
  }
}

// Sample transaction data
const transactions: Transaction[] = [
  {
    id: "0x1234...5678",
    type: "swap",
    status: "completed",
    timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    fromToken: {
      symbol: "ETH",
      amount: 0.1,
    },
    toToken: {
      symbol: "USDC",
      amount: 350,
    },
  },
  {
    id: "0xabcd...efgh",
    type: "approve",
    status: "completed",
    timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    fromToken: {
      symbol: "UIS",
      amount: 0,
    },
  },
  {
    id: "0x9876...5432",
    type: "swap",
    status: "pending",
    timestamp: Date.now() - 1000 * 60 * 2, // 2 minutes ago
    fromToken: {
      symbol: "USDC",
      amount: 100,
    },
    toToken: {
      symbol: "UIS",
      amount: 40,
    },
  },
]

export function RecentTransactions() {
  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 1000 * 60) {
      return "just now"
    } else if (diff < 1000 * 60 * 60) {
      return `${Math.floor(diff / (1000 * 60))}m ago`
    } else if (diff < 1000 * 60 * 60 * 24) {
      return `${Math.floor(diff / (1000 * 60 * 60))}h ago`
    } else {
      return `${Math.floor(diff / (1000 * 60 * 60 * 24))}d ago`
    }
  }

  const getStatusIcon = (status: Transaction["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-400" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-400" />
    }
  }

  const getTransactionText = (transaction: Transaction) => {
    switch (transaction.type) {
      case "swap":
        return `Swap ${transaction.fromToken.amount} ${transaction.fromToken.symbol} for ${transaction.toToken?.amount} ${transaction.toToken?.symbol}`
      case "approve":
        return `Approve ${transaction.fromToken.symbol}`
      case "add":
        return `Add liquidity ${transaction.fromToken.symbol}/${transaction.toToken?.symbol}`
      case "remove":
        return `Remove liquidity ${transaction.fromToken.symbol}/${transaction.toToken?.symbol}`
    }
  }

  return (
    <div className="space-y-2 mt-2 bg-slate-700/50 rounded-lg p-3">
      {transactions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400">No recent transactions</p>
        </div>
      ) : (
        <>
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between py-2 border-b border-slate-600 last:border-0"
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(transaction.status)}
                <div>
                  <p className="text-sm text-white">{getTransactionText(transaction)}</p>
                  <p className="text-xs text-slate-400">{formatTime(transaction.timestamp)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-slate-600"
                onClick={() => window.open(`https://etherscan.io/tx/${transaction.id}`, "_blank")}
              >
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          ))}
          <div className="text-center pt-2">
            <Button variant="link" className="text-xs text-purple-400 hover:text-purple-300">
              View all transactions
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
