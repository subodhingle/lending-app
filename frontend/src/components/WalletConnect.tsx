import { useWallet } from '../context/wallet-context'

export function WalletConnect() {
  const { address, connected, connecting, connect, disconnect, error } = useWallet()

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  return (
    <div className="flex flex-col items-end gap-1">
      {connected ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-[#e0e0d8] rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-sm font-mono text-[#1a1a1a]">{shortAddress}</span>
          </div>
          <button
            onClick={disconnect}
            className="text-xs text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors px-2 py-1 rounded border border-[#e0e0d8] bg-white hover:bg-[#f5f5f0]"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={connecting}
          className="bg-[#1a1a1a] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting ? 'Connecting...' : 'Connect Freighter'}
        </button>
      )}
      {error && (
        <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>
      )}
    </div>
  )
}
