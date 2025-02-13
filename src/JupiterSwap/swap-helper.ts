import { VersionedTransaction, PublicKey, Keypair, BlockhashWithExpiryBlockHeight } from "@solana/web3.js";
import fetch from "cross-fetch";
// import {  wallet, jito_fee } from "../../helpers/config";
import { jito_executeAndConfirm } from "../transactions/jito_tips_tx_executor";
import { connection } from "../main";
import { JITO_FEE } from "../config";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { simple_executeAndConfirm } from "../transactions/simple_tx_executor";
// import { getDecimals } from "../../helpers/util";
/**
 * Retrieves a quote for swapping tokens.
 *
 * @param {string} tokenToSell - The output token's mint address.
 * @param {string} tokenToBuy - The input token's mint address.
 * @param {number} convertedAmountOfTokenOut - The amount of output token to be converted.
 * @param {number} slippage - The allowed slippage in basis points.
 * @returns {Promise<object>} - The quote object containing swap details.
 */
const wallet = Keypair.fromSecretKey(
  bs58.decode(process.env.PRIVATE_KEY_CHILD_WALLET || "")
); // your wallet
export async function getDecimals(mintAddress: PublicKey): Promise<number> {
  const info: any = await connection.getParsedAccountInfo(mintAddress);
  const result = (info.value?.data).parsed.info.decimals || 0;
  return result;
}
export async function getQuote(
  tokenToSell: string,
  tokenToBuy: string,
  convertedAmountOfTokenOut: number,
  slippage: any
) {
  const url = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenToSell}&outputMint=${tokenToBuy}&amount=${convertedAmountOfTokenOut}&slippageBps=${slippage}`;
  const response = await fetch(url);
  const quote = await response.json();
  return quote;
}

/**
 * Retrieves the swap transaction from the quote API.
 * @param {Object} quoteResponse - The quote response object.
 * @param {string} wallet_pubKey - The public key of the user's wallet.
 * @returns {Promise<string>} - The swap transaction.
 * @throws {Error} - If an error occurs during the process.
 */
export async function getSwapTransaction(
  quoteResponse: any,
  wallet_pubKey: string
) {
  try {
    let body = {};
    body = {
      quoteResponse,
      userPublicKey: wallet_pubKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true, // allow dynamic compute limit instead of max 1,400,000
      prioritizationFeeLamports: 4211970, // prioritization fee
    };
    const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const swapResponse = await resp.json();
    return swapResponse.swapTransaction;
  } catch (error: any) {
    throw new Error(error);
  }
}
/**
 * Converts the given amount to an integer by multiplying it with 10 raised to the power of decimals.
 * @param {number} amount - The amount to be converted.
 * @param {number} decimals - The number of decimal places.
 * @returns {Promise<number>} The converted integer value.
 */
export async function convertToInteger(amount: number, decimals: number) {
  return Math.floor(amount * 10 ** decimals);
}

/**
 * Finalizes a swap transaction by deserializing, signing, and executing the transaction.
 * @param {string} swapTransaction - The base64 encoded swap transaction.
 * @returns {Promise<{ confirmed: boolean, signature: string }>} - A promise that resolves to an object containing the confirmation status and transaction signature.
 * @throws {Error} - If an error occurs during the transaction finalization process.
 */
export async function finalizeTransaction(swapTransaction: any): Promise<{ confirmed: boolean; signature: string; }> {
  try {
    
    let confirmed = false, signature = null;
    // deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    console.log("?????????????????????????????????????????");
    let transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    // sign the transaction
    transaction.sign([wallet]);
    
    const latestBlockhash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash("confirmed");
    // const res = await jito_executeAndConfirm(
    //   transaction,
    //   wallet,
    //   latestBlockhash,
    //   JITO_FEE
    // );
    const res = await simple_executeAndConfirm (transaction, wallet, latestBlockhash);
    confirmed = res.confirmed;
    signature = res.signature;
    return { confirmed, signature };
  } catch (error: any) {
    throw new Error(error);
  }
  // return { confirmed: false, signature: null };
}
/**
 * Performs a token swap transaction.
 *
 * @param {string} tokenToSell - The token to sell.
 * @param {string} tokenToBuy - The token to buy.
 * @param {number} amountTokenOut - The amount of token to receive.
 * @param {number} slippage - The allowed slippage percentage.
 * @returns {Promise<void>} - A promise that resolves when the swap transaction is completed.
 */
export async function swap(
  tokenToSell: string,
  tokenToBuy: string,
  amountTokenOut: number,
  slippage: any
) {
  try {
    const decimals = await getDecimals(new PublicKey(tokenToSell));
    const convertedAmountOfTokenOut = await convertToInteger(
      amountTokenOut,
      decimals
    );
    const quoteResponse = await getQuote(
      tokenToSell,
      tokenToBuy,
      convertedAmountOfTokenOut,
      slippage
    );
    const wallet_PubKey = wallet.publicKey.toBase58();
    const swapTransaction = await getSwapTransaction(
      quoteResponse,
      wallet_PubKey
    );
    const { confirmed, signature } = await finalizeTransaction(swapTransaction);
    if (confirmed) {
      console.log("http://solscan.io/tx/" + signature);
    } else {
      console.log("Transaction failed");
      console.log("retrying transaction...");
      await swap(tokenToSell, tokenToBuy, amountTokenOut, slippage);
    }
  } catch (error) {
    console.error(error);
  }
}
