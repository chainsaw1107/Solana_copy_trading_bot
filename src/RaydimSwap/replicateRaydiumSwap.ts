import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { LIQUIDITY_VERSION_TO_STATE_LAYOUT } from "@raydium-io/raydium-sdk-v2";
import * as dotenv from "dotenv";
import { RPC_ENDPOINT } from "../config";
dotenv.config();
const RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";
// CANNOT USE MAINNET RPC DUE TO RESOURCE USE, USE QUICK NODE OR HELIUS
const RPC = RPC_ENDPOINT;

/**
 * Retrieves the pool ID based on the provided token address.
 *
 * @param baseTokenAddress - The token address used to retrieve the pool ID.
 * @returns The pool ID as a string if found, otherwise null.
 */
export async function getPoolID(baseTokenAddress: string): Promise<string> {
  let base = new PublicKey(baseTokenAddress);
  const quote = new PublicKey(WSOL_ADDRESS);
  const commitment: Commitment = "confirmed";

  try {
    const connection = new Connection(RPC);
    // First try with base
    const baseAccounts = await connection.getProgramAccounts(new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS), {
      commitment,
      filters: [
        { dataSize: LIQUIDITY_VERSION_TO_STATE_LAYOUT[4].span },
        {
          memcmp: {
            offset: LIQUIDITY_VERSION_TO_STATE_LAYOUT[4].offsetOf("baseMint"),
            bytes: base.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_VERSION_TO_STATE_LAYOUT[4].offsetOf("quoteMint"),
            bytes: quote.toBase58(),
          },
        },
      ],
    });

    if (baseAccounts.length > 0) {
      const { pubkey } = baseAccounts[0];
      return pubkey.toString();
    }

    // If base fails, try with quote
    const quoteAccounts = await connection.getProgramAccounts(new PublicKey(RAYDIUM_LIQUIDITY_POOL_V4_ADDRESS), {
      commitment,
      filters: [
        { dataSize: LIQUIDITY_VERSION_TO_STATE_LAYOUT[4].span },
        {
          memcmp: {
            offset: LIQUIDITY_VERSION_TO_STATE_LAYOUT[4].offsetOf("baseMint"),
            bytes: quote.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_VERSION_TO_STATE_LAYOUT[4].offsetOf("quoteMint"),
            bytes: base.toBase58(),
          },
        },
      ],
    });

    if (quoteAccounts.length > 0) {
      const { pubkey } = quoteAccounts[0];
      return pubkey.toString();
    }

    return "null";
  } catch (error) {
    console.error("Error fetching Market accounts:", error);
    return "null";
  }
}