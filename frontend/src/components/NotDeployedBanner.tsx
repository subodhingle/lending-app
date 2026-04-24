import { contractsDeployed } from '../lib/ContractInteraction'

export function NotDeployedBanner() {
  if (contractsDeployed()) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 mb-4">
      <span className="text-amber-500 text-lg shrink-0">⚠️</span>
      <div>
        <p className="font-semibold text-amber-800 text-sm">Contracts not deployed</p>
        <p className="text-amber-700 text-xs mt-0.5">
          Run{' '}
          <code className="bg-amber-100 px-1 rounded font-mono">scripts/deploy.sh</code>{' '}
          to deploy to Stellar Testnet, then update{' '}
          <code className="bg-amber-100 px-1 rounded font-mono">frontend/.env</code>{' '}
          with the real contract IDs and restart the dev server.
        </p>
      </div>
    </div>
  )
}
