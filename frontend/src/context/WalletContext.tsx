import React, { useState, useCallback, useEffect } from 'react'
import { isConnected, getAddress, isAllowed, requestAccess } from '@stellar/freighter-api'
import { WalletContext } from './wallet-context'

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-reconnect if already allowed
  useEffect(() => {
    const tryAutoConnect = async () => {
      try {
        const allowedResult = await isAllowed()
        if (allowedResult.isAllowed) {
          const connectedResult = await isConnected()
          if (connectedResult.isConnected) {
            const addrResult = await getAddress()
            if (!addrResult.error && addrResult.address) {
              setAddress(addrResult.address)
            }
          }
        }
      } catch {
        // Freighter not installed or not available
      }
    }
    tryAutoConnect()
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const connectedResult = await isConnected()
      if (!connectedResult.isConnected) {
        setError('Freighter wallet not found. Please install it from freighter.app')
        return
      }
      // Request access if not already allowed
      const allowedResult = await isAllowed()
      if (!allowedResult.isAllowed) {
        const accessResult = await requestAccess()
        if (accessResult.error) {
          setError(accessResult.error)
          return
        }
      }
      const addrResult = await getAddress()
      if (addrResult.error) {
        setError(addrResult.error)
        return
      }
      setAddress(addrResult.address)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
    setError(null)
  }, [])

  return (
    <WalletContext.Provider
      value={{
        address,
        connected: !!address,
        connecting,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}
