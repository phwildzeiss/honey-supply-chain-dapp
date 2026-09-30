import { defineConfig } from "@wagmi/cli";
import { hardhat, react } from "@wagmi/cli/plugins";

export default defineConfig({
  out: "src/generated.ts",
  plugins: [
    hardhat({
      project: "../honey-supply-chain",
      include: [
        "ActorRegistry.json",
        "HoneyToken.json",
        "QualityIndex.json",
        "PricingModel.json",
        "SupplyChain.json",
        "ConsumerGateway.json",
      ],
    }),
    react(),
  ],
});
