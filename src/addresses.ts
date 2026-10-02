// Deployed contract addresses per chain. Kept by hand instead of baked into the generated hooks
// (via @wagmi/cli's `deployments` option), so a redeploy only means editing this one file, not
// regenerating src/generated.ts.
export const addresses = {
  31337: {
    ActorRegistry: "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1",
    HoneyToken: "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44",
    QualityIndex: "0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f",
    PricingModel: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
    SupplyChain: "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F",
    ConsumerGateway: "0x09635F643e140090A9A8Dcd712eD6285858ceBef",
  },
  11155111: {
    ActorRegistry: "0x4F2879117B09Db0b2cD751b8D12e3A7B7Ac9CA53",
    HoneyToken: "0x284c01F1069f6f66FBA54426d88b94979D358138",
    QualityIndex: "0x1A696573596889b9B778fB37b41c3344D0409D0f",
    PricingModel: "0x8D82E6C51157932B343f9ae38a5C17034910d77b",
    SupplyChain: "0x38Aa673576cb9ECf1fac95AF1cC963c7c8A76F6a",
    ConsumerGateway: "0x95C4c8de8DE3a921E8cD4E55257c1dB499976Ee5",
  },
} as const;
