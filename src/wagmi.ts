import { createConfig, http, injected } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

// Falls VITE_SEPOLIA_RPC_URL fehlt, nutzt viem intern seine eigene öffentliche Sepolia-RPC (Drittanbieter,
// nicht für eine Demo gedacht). Die URL landet im öffentlichen Browser-Bundle, das ist bei einer reinen
// RPC-URL unkritisch (kein privater Schlüssel), sollte aber bewusst sein.
export const config = createConfig({
  chains: [sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
    [hardhat.id]: http(),
  },
});
