import { useParams, Link } from 'react-router-dom'
import { useChainId, useConnection } from 'wagmi'
import {
  useReadConsumerGatewayGetBatchData,
  useReadConsumerGatewayGetPrice,
  useReadConsumerGatewayGetQualityData,
  useReadQualityIndexPhqiReportCid,
  useReadQualityIndexAwardCertificateCid,
  useReadQualityIndexOriginCid,
  useReadActorRegistryCertifications,
} from '../generated'
import { addresses } from '../addresses'
import ActorLabel from '../components/ActorLabel'

const STATES = ['Active', 'RetestRequired', 'NotSellable']
const REASONS = ['None', 'WaterContentExceeded', 'TemperatureViolation']
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

function BatchDetail() {
  const { batchId } = useParams()
  const chainId = useChainId()
  const { address } = useConnection()
  const consumerGateway = addresses[chainId as keyof typeof addresses]?.ConsumerGateway
  const qualityIndex = addresses[chainId as keyof typeof addresses]?.QualityIndex
  const actorRegistry = addresses[chainId as keyof typeof addresses]?.ActorRegistry
  const id = batchId ? BigInt(batchId) : undefined
  const enabled = Boolean(consumerGateway && id !== undefined)

  const { data: batchData } = useReadConsumerGatewayGetBatchData({
    address: consumerGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled },
  })
  const { data: qualityData } = useReadConsumerGatewayGetQualityData({
    address: consumerGateway,
    args: id !== undefined ? [id] : undefined,
    query: { enabled },
  })
  const priceQuery = useReadConsumerGatewayGetPrice({
    address: consumerGateway,
    args: id !== undefined ? [id, 500] : undefined,
    query: { enabled },
  })

  if (!batchData || !qualityData) {
    return <p>Lädt...</p>
  }

  const [batch, holder] = batchData
  const [si, phqi, mci, qi, state, reason] = qualityData

  return (
    <div>
      <h1>Charge #{batchId}</h1>
      <p>Erntejahr: {batch.harvestYear}</p>
      <p>Imker: <ActorLabel address={batch.beekeeper} /></p>
      <p>Menge: {(Number(batch.quantity) / 1000).toFixed(1)} kg</p>
      <p>Aktueller Halter: <ActorLabel address={holder} /></p>
      <p>SI: {si.toString()}</p>
      <p>PHQI: {phqi.toString()}</p>
      <p>MCI: {mci.toString()}</p>
      <p>QI: {qi.toString()}</p>
      <p>Zustand: {STATES[state]}</p>
      <p>Grund: {REASONS[reason]}</p>
      <p>
        Preis (500 g):{' '}
        {priceQuery.isError
          ? 'nicht verkäuflich'
          : priceQuery.data !== undefined
            ? `${(Number(priceQuery.data) / 100).toFixed(2)} €`
            : '...'}
      </p>
      {address?.toLowerCase() === batch.beekeeper.toLowerCase() && (
        <p><Link to={`/batches/${batchId}/origin`}>Herkunft eintragen</Link></p>
      )}
      <BatchDocuments
        batchId={id}
        beekeeper={batch.beekeeper}
        qualityIndex={qualityIndex}
        actorRegistry={actorRegistry}
      />
    </div>
  )
}

function BatchDocuments({
  batchId,
  beekeeper,
  qualityIndex,
  actorRegistry,
}: {
  batchId: bigint | undefined
  beekeeper: `0x${string}`
  qualityIndex: `0x${string}` | undefined
  actorRegistry: `0x${string}` | undefined
}) {
  const { data: labReportCid } = useReadQualityIndexPhqiReportCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })
  const { data: awardCertificateCid } = useReadQualityIndexAwardCertificateCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })
  const { data: certificationData } = useReadActorRegistryCertifications({
    address: actorRegistry,
    args: [beekeeper],
    query: { enabled: Boolean(actorRegistry) },
  })
  const [beekeeperCertCid] = certificationData ?? ['']
  const { data: originCid } = useReadQualityIndexOriginCid({
    address: qualityIndex,
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: Boolean(qualityIndex && batchId !== undefined) },
  })

  return (
    <>
      <p>
        Herkunftsangabe:{' '}
        {originCid ? (
          <a href={IPFS_GATEWAY + originCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : (
          'noch nicht eingetragen'
        )}
      </p>
      <p>
        Laboranalyse:{' '}
        {labReportCid ? (
          <a href={IPFS_GATEWAY + labReportCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : (
          'noch nicht vorhanden'
        )}
      </p>
      <p>
        Prämierungsurkunde:{' '}
        {awardCertificateCid ? (
          <a href={IPFS_GATEWAY + awardCertificateCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : (
          'noch nicht vorhanden'
        )}
      </p>
      <p>
        Zertifikat des Imkers:{' '}
        {beekeeperCertCid ? (
          <a href={IPFS_GATEWAY + beekeeperCertCid} target="_blank" rel="noreferrer">
            ansehen
          </a>
        ) : (
          'nicht zertifiziert'
        )}
      </p>
    </>
  )
}

export default BatchDetail
