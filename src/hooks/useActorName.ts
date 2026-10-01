import { useChainId } from 'wagmi'
import { useReadActorRegistryGetActor } from '../generated'
import { addresses } from '../addresses'

export function useActorName(address: string | undefined) {
    const chainId = useChainId()
    const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry

    const { data: actor } = useReadActorRegistryGetActor({
        address: actorRegistry,
        args: address ? [address] : undefined,
        query: { enabled: Boolean(actorRegistry && address) },
    })

    return actor?.registered ? actor.name : 'nicht registriert'
}
