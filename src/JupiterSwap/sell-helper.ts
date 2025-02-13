import {
  convertToInteger,
  getQuote,
  getSwapTransaction,
  finalizeTransaction,
} from "./swap-helper";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {  getTokenAccountBalance } from "../config";
import { fileOperation } from "../fileOperation";
import { gasFeeAmountIn } from "../send";
const wsol = "So11111111111111111111111111111111111111112";
/**
 * Sells a specified amount of a token on the DEX.
 * @param {string} tokenToSell - The address of the token to sell.
 * @param {number} amountOfTokenToSell - The amount of the token to sell.
 * @param {number} slippage - The slippage tolerance percentage.
 * @returns {Promise<void>} - A promise that resolves when the sell operation is completed.
 */

export async function sellOnJupiter(
connection: Connection, tokenToSell: string, percentageSold: number, slippage: any, trade_log: any) {
  const wallet = Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_CHILD_WALLET || "")
  ); // your wallet
  async function getDecimals(mintAddress: PublicKey): Promise<number> {
    const info: any = await connection.getParsedAccountInfo(mintAddress);
    const result = (info.value?.data).parsed.info.decimals || 0;
    return result;
  }
  try {
    // gasFeeAmountIn(connection);
    const decimals = await getDecimals(new PublicKey(tokenToSell));
    trade_log[`Sold Token decimal: `] = decimals;
    console.log(decimals);
    let token_in_wallet = await getTokenAccountBalance(
      connection,
      wallet.publicKey.toBase58(),
      tokenToSell,
    );
    const amountOfTokenToSell = token_in_wallet.uiAmount * percentageSold / 100;
    const convertedAmountOfTokenOut = await convertToInteger(
      amountOfTokenToSell,
      decimals
    );
    trade_log[`Sold Token amount: `] = convertedAmountOfTokenOut;
    console.log(convertedAmountOfTokenOut);
    const quoteResponse = await getQuote(
      tokenToSell,
      wsol,
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
      trade_log[`Explorer: `] = `http://solscan.io/tx/${signature}`;
      console.log("http://solscan.io/tx/" + signature);
      await fileOperation(trade_log);
      trade_log = {};
      return;
    } else {
      console.log("Transaction failed");
      console.log("retrying transaction...");
      await sellOnJupiter(connection, tokenToSell, amountOfTokenToSell, slippage, trade_log);
    }
  } catch (error) {
    console.error(error);
    return;
  }
}
