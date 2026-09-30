import { useAccount, useChainId, useReadContracts } from 'wagmi'
import { actorRegistryAbi } from '../generated'
import { addresses } from '../addresses'

const ROLE_FUNCTION_NAMES = ['BEEKEEPER_ROLE', 'BOTTLER_ROLE', 'RETAILER_ROLE', 'LOGISTICS_ROLE'] as const

export function useMyRoles() {
  const { address } = useAccount()
  const chainId = useChainId()
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry

  // Stage 1: read the four role hashes (constants on the contract, but not hardcoded here —
  // if ActorRegistry ever changed how it derives them, this would still be correct).
  const roleHashesQuery = useReadContracts({
    contracts: ROLE_FUNCTION_NAMES.map((functionName) => ({
      address: actorRegistry,
      abi: actorRegistryAbi,
      functionName,
    })),
    query: { enabled: Boolean(actorRegistry) },
  })
  const roleHashes = roleHashesQuery.data?.map((entry) => entry.result as `0x${string}` | undefined)

  // Stage 2: check hasRole(hash, address) for each — depends on stage 1's results, so it only
  // runs once all four hashes are in.
  const hasRoleQuery = useReadContracts({
    contracts: (roleHashes ?? []).map((role) => ({
      address: actorRegistry,
      abi: actorRegistryAbi,
      functionName: 'hasRole',
      args: role && address ? [role, address] : undefined,
    })),
    query: { enabled: Boolean(actorRegistry && address && roleHashes?.every(Boolean)) },
  })
  const [beekeeper, bottler, retailer, logistics] =
    hasRoleQuery.data?.map((entry) => Boolean(entry.result)) ?? []

  return {
    beekeeper: beekeeper ?? false,
    bottler: bottler ?? false,
    retailer: retailer ?? false,
    logistics: logistics ?? false,
    isLoading: roleHashesQuery.isLoading || hasRoleQuery.isLoading,
  }
}
