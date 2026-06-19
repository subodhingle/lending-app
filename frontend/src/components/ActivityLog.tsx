import { useEffect, useState } from 'react'
import { getEvents, formatAmount, type ProtocolEvent } from '../lib/ContractInteraction'

export function ActivityLog() {
  const [events, setEvents] = useState<ProtocolEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = () => {
    getEvents()
      .then((data) => {
        setEvents(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching events:', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 8000) // Poll every 8s
    return () => clearInterval(interval)
  }, [])

  const truncateAddr = (addr?: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="bg-[#141414] text-white border border-[#2d2d2d] rounded-2xl p-5 shadow-xl font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-[#2d2d2d] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-green-400">
            Live Protocol Feed
          </h2>
        </div>
        <span className="text-[10px] text-[#888888] uppercase">Soroban RPC Events</span>
      </div>

      {loading && events.length === 0 ? (
        <p className="text-xs text-[#888888] py-4">Connecting to ledger events stream...</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-[#888888] py-4">No recent protocol events found in this ledger range.</p>
      ) : (
        <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
          {events.map((evt) => {
            const time = formatTime(evt.timestamp)
            return (
              <div key={evt.id} className="text-xs flex items-start justify-between gap-4 border-b border-[#1f1f1f] pb-2 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {evt.type === 'deposit' && (
                      <span className="text-green-400 font-bold">🟢 DEPOSIT</span>
                    )}
                    {evt.type === 'borrow' && (
                      <span className="text-blue-400 font-bold">↗️ BORROW</span>
                    )}
                    {evt.type === 'repay' && (
                      <span className="text-amber-400 font-bold">↩️ REPAY</span>
                    )}
                    {evt.type === 'withdraw' && (
                      <span className="text-purple-400 font-bold">⬆️ WITHDRAW</span>
                    )}
                    {evt.type === 'liquidate' && (
                      <span className="text-red-400 font-bold">⚡ LIQUIDATE</span>
                    )}
                    {evt.type === 'price' && (
                      <span className="text-sky-400 font-bold">📊 ORACLE PRICE</span>
                    )}

                    <span className="text-[10px] text-[#666666]">ledger #{evt.ledger}</span>
                  </div>

                  <p className="text-[#cccccc] text-[11px] leading-relaxed">
                    {evt.type === 'price' && (
                      <>XLM Oracle Feed updated: <span className="text-sky-400">${evt.price?.toFixed(4)}</span></>
                    )}
                    {(evt.type === 'deposit' || evt.type === 'borrow' || evt.type === 'repay' || evt.type === 'withdraw') && (
                      <>
                        Address <span className="text-white hover:underline cursor-pointer" title={evt.user}>{truncateAddr(evt.user)}</span> processed{' '}
                        <span className="text-white font-semibold">
                          {formatAmount(evt.amount || 0n)}{' '}
                          {evt.type === 'deposit' || evt.type === 'withdraw' ? 'XLM' : 'dTOKEN'}
                        </span>
                      </>
                    )}
                    {evt.type === 'liquidate' && (
                      <>
                        Liquidator <span className="text-white" title={evt.liquidator}>{truncateAddr(evt.liquidator)}</span> repaid{' '}
                        <span className="text-red-400 font-semibold">{formatAmount(evt.amount || 0n)} dTOKEN</span> for{' '}
                        <span className="text-white" title={evt.borrower}>{truncateAddr(evt.borrower)}</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-[#666666] shrink-0 mt-0.5">{time}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
