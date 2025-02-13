import { getQuote, getSwapTransaction, convertToInteger, finalizeTransaction } from "./swap-helper";
import { Keypair } from "@solana/web3.js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { fileOperation } from "../fileOperation";
// import { gasFeeAmountIn } from "../send";
// import { connection } from "../main";
import { PRIVATE_KEY_CHILD_WALLET } from "../config";
const wsol = "So11111111111111111111111111111111111111112";

/**
 * Buys a token using the specified parameters.
 *
 * @param {string} tokenToBuy - The token to be swapped for.
 * @param {number} amountTokenOut - The amount of token to be received.
 * @param {number} slippage - The slippage tolerance percentage.
 * @returns {Promise<void>} - A promise that resolves when the buy operation is completed.
 * @throws {Error} - If an error occurs during the buy operation.
 */

export async function buyOnJupiter(tokenToBuy: string, amountTokenOut: number, slippage: any, trade_log: any) {
  const wallet = Keypair.fromSecretKey(
    bs58.decode(PRIVATE_KEY_CHILD_WALLET)
  );
  try {
    const convertedAmountOfTokenOut = await convertToInteger(
      amountTokenOut,
      9
    );
    const quoteResponse = await getQuote(
      wsol,
      tokenToBuy,
      convertedAmountOfTokenOut,
      slippage
    );
    // gasFeeAmountIn(connection);
    console.log(quoteResponse);
    const wallet_PubKey = wallet.publicKey.toBase58();
    const swapTransaction = await getSwapTransaction(
      quoteResponse,
      wallet_PubKey
    );
    const { confirmed, signature } =
      await finalizeTransaction(swapTransaction);
    if (confirmed) {
      trade_log[`Explorer: `] = `http://solscan.io/tx/${signature}`;
      console.log("http://solscan.io/tx/" + signature);
      await fileOperation(trade_log);
      trade_log = {};
      return;
    } else {
      console.log("Transaction failed");
      console.log("retrying transaction...");
      await buyOnJupiter(tokenToBuy, amountTokenOut, slippage, trade_log);
    }
  } catch (error) {
    console.error(error);
    return;
  }
}
buyOnJupiter("CFzhqSNqYZRsUszCGwZ3SJ9iPHLvSumffaS6gWuupump", 0.00001, 10, {})
