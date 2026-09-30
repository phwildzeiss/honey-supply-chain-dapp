// Deployed contract addresses per chain. Kept by hand instead of baked into the generated hooks
// (via @wagmi/cli's `deployments` option), so a redeploy only means editing this one file, not
// regenerating src/generated.ts.
export const addresses = {
  31337: {
    ActorRegistry: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    HoneyToken: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    QualityIndex: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    PricingModel: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    SupplyChain: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    ConsumerGateway: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
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
