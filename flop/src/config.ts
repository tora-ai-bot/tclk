// SPDX-License-Identifier: Apache-2.0
import { checkSymmetryParams, type FlopSymmetryParams } from "./symmetry.js";
export type FlopNetwork = "devnet" | "testnet" | "mainnet";
export interface FlopRailConfig {
  network?: FlopNetwork;
  rpcUrl?: string;
  /** Pin an operator-published genesis, never a value taken from a lock frame. */
  expectedGenesisHash?: string;
  /** Nominal block duration; FLOP currently targets one second. */
  blockTimeMs?: number;
  /** Extra blocks before refund; also bounds lock-inclusion delay. */
  refundMarginBlocks?: number;
  /**
   * Opt-in R10.2 admission check (the finality-open gate, then the timelock-symmetry
   * margin), with all three values read from the live runtime. No default: absent, no
   * check runs. A testnet-only approximation (claimByMs stands in for the counter-chain
   * duration), not mainnet conformance.
   */
  symmetry?: FlopSymmetryParams;
}
export interface ResolvedFlopConfig {
  network: FlopNetwork;
  rpcUrl: string;
  expectedGenesisHash?: string;
  blockTimeMs: number;
  refundMarginBlocks: number;
  /** Present only when configured. */
  symmetry?: Readonly<FlopSymmetryParams>;
}
export const HEX32 = /^0x[0-9a-f]{64}$/;
export function resolveFlopConfig(
  input: FlopRailConfig = {},
): Readonly<ResolvedFlopConfig> {
  const network = input.network ?? "devnet";
  if (!["devnet", "testnet", "mainnet"].includes(network))
    throw new Error("flop: invalid network");
  // Testnet/mainnet are planned networks, so there are no invented production defaults.
  if (network !== "devnet" && (!input.rpcUrl || !input.expectedGenesisHash)) {
    throw new Error(
      "flop: testnet/mainnet require rpcUrl and expectedGenesisHash",
    );
  }
  const rpcUrl = input.rpcUrl ?? "wss://rpc.devnet.flop.network";
  const url = new URL(rpcUrl);
  if (
    !["ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error(
      "flop: rpcUrl must be a WebSocket URL without credentials or fragment",
    );
  }
  if (
    input.expectedGenesisHash !== undefined &&
    !HEX32.test(input.expectedGenesisHash)
  ) {
    throw new Error("flop: malformed expectedGenesisHash");
  }
  const blockTimeMs = input.blockTimeMs ?? 1000;
  const refundMarginBlocks = input.refundMarginBlocks ?? 30;
  for (const [field, value] of Object.entries({
    blockTimeMs,
    refundMarginBlocks,
  })) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 0xffffffff) {
      throw new Error(`flop: invalid ${field}`);
    }
  }
  // Exact fields: a misspelt parameter must not leave the check half-configured.
  const symmetry =
    input.symmetry === undefined
      ? undefined
      : checkSymmetryParams(input.symmetry);
  return Object.freeze({
    network,
    rpcUrl,
    expectedGenesisHash: input.expectedGenesisHash,
    blockTimeMs,
    refundMarginBlocks,
    ...(symmetry ? { symmetry } : {}),
  });
}
