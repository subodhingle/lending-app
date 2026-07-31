import { createContext, useContext } from 'react'

export interface WalletContextType {
  address: string | null
  connected: boolean
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  error: string | null
}

export const WalletContext = createContext<WalletContextType>({
  address: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
  error: null,
})

export function useWallet() {
  return useContext(WalletContext)
}
