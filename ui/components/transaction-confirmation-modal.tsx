"use client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, ArrowUpRight } from "lucide-react"

export type TransactionStatus = "pending" | "success" | "error"

interface TransactionConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  status: TransactionStatus
  txHash?: string
}

export function TransactionConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  status,
  txHash,
}: TransactionConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-800 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6">
          {status === "pending" && (
            <div className="rounded-full bg-blue-500/20 p-3 mb-4">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            </div>
          )}

          {status === "success" && (
            <div className="rounded-full bg-green-500/20 p-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          )}

          {status === "error" && (
            <div className="rounded-full bg-red-500/20 p-3 mb-4">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          )}

          <p className="text-center text-slate-300 mb-6">{description}</p>

          {txHash && (
            <a
              href={`https://etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 mb-6"
            >
              View on Explorer <ArrowUpRight className="h-3 w-3" />
            </a>
          )}

          <div className="flex gap-4">
            {status === "pending" && (
              <Button
                variant="outline"
                className="bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}

            {(status === "success" || status === "error") && (
              <Button
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
