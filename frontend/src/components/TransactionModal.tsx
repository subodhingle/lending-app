interface TransactionModalProps {
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
  onClose: () => void
}

export function TransactionModal({ status, message, onClose }: TransactionModalProps) {
  if (status === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-[#e0e0d8]">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-12 h-12 border-4 border-[#e0e0d8] border-t-[#1a1a1a] rounded-full animate-spin" />
            <p className="text-sm text-[#6b6b6b] text-center">
              {message || 'Processing transaction...'}
            </p>
            <p className="text-xs text-[#6b6b6b] text-center">
              Please confirm in Freighter wallet
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-[#1a1a1a]">Transaction Successful</p>
              {message && <p className="text-sm text-[#6b6b6b] mt-1">{message}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-full bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-[#1a1a1a]">Transaction Failed</p>
              {message && (
                <p className="text-sm text-red-600 mt-1 break-all max-h-24 overflow-y-auto">
                  {message}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full border border-[#e0e0d8] text-[#1a1a1a] py-2.5 rounded-xl text-sm font-medium hover:bg-[#f5f5f0] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
