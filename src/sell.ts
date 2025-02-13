import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  BlockhashWithExpiryBlockHeight,
  Transaction,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import BN from 'bn.js';
import fs from 'fs';
import {
  initSdk,
  getRandomRunTime,
  getRandomNumber,
  logger,
  getWallet,
  getCoinBalance,
  getTokenAccount,
  getTokenBalance,
  getTokenDecimal,
  JITO_FEE,
  fetchWithTimeout,
  getTokenAccountBalance,
  sleep,
} from './config';
import {
  MIN_BUY_QUANTITY,
  MAX_BUY_QUANTITY,
  MIN_SELL_QUANTITY,
  MAX_SELL_QUANTITY,
  MIN_TIME,
  MAX_TIME,
  MIN_TRADE_WAIT,
  MAX_TRADE_WAIT,
  RPC_ENDPOINT,
  PROVIDER_PRIVATE_KEY,
  TOKEN_ADDRESS,
  SLIPPAGE,
  SEND_SOL_AMOUNT,
  NUMBER_OF_WALLETS,
  COMPUTE_UNIT_PRICE,
  COMPUTE_UNIT_LIMIT,
  TRANSACTION_COUNT_PER_BUNDLE,
  JITO_FEE_PAYER_PRIVATE_KEY,
  BUFFER,
} from './config';

import { getPoolInfo, getAmountOut, makeSwapTransaction, executeAndConfirm } from './clmm/Raydiumswap';
import { Account, NATIVE_MINT } from '@solana/spl-token';
import { executeAndConfirmByJito } from './jito-bundle';
import { Raydium } from '@raydium-io/raydium-sdk-v2';
import bs58 from 'bs58';
import wallets from '../wallets.json';

let clmmPoolInfomation: any;
const connection: Connection = new Connection(RPC_ENDPOINT, {
  fetch: fetchWithTimeout,
  commitment: 'confirmed',
});
const providerWallet: Keypair = getWallet(PROVIDER_PRIVATE_KEY);
const jitoFeeWallet: Keypair = getWallet(JITO_FEE_PAYER_PRIVATE_KEY);
let tokenDecimal: number;
let transactionCountPerBundle: number = TRANSACTION_COUNT_PER_BUNDLE;

interface WALLET_STATUS {
  wallet: Keypair;
  id: number;
}

let walletArray: WALLET_STATUS[] = [];

const main = async () => {
  const sellToken =  TOKEN_ADDRESS;
  let tokenAmount = Number(getRandomNumber(MIN_SELL_QUANTITY, MAX_SELL_QUANTITY)) ; 
  await sell(sellToken, tokenAmount);
};
export const sell = async (sellToken : string, tokenAmountPercentage: number) => {
  for (let i = 0; i < NUMBER_OF_WALLETS; i++) {
    const keypair: Keypair = getWallet(wallets[i].secretKey);
    walletArray = [...walletArray, { wallet: keypair, id: i }];
  }
  try {
    if (!tokenDecimal) {
      tokenDecimal = await getTokenDecimal(connection, new PublicKey(sellToken));
    }
    let walletAmount = walletArray.length;
    if (walletAmount === 0) {
      logger.info('Please buy token for the child wallets.');
      process.exit(1);
    }

    for (let i = 0; i < Math.min(transactionCountPerBundle, walletAmount); i++) {
      if (!clmmPoolInfomation) {
        clmmPoolInfomation = await getPoolInfo(connection, providerWallet, sellToken);
      }

      const raydium: Raydium = await initSdk(connection, walletArray[i].wallet, 'mainnet');

      // let tokenAmount = getRandomNumber(MIN_SELL_QUANTITY, MAX_SELL_QUANTITY);
      let lampAmount = await getCoinBalance(connection, walletArray[i].wallet.publicKey);
      let token_in_wallet = await getTokenAccountBalance(
        connection,
        walletArray[i].wallet.publicKey.toBase58(),
        sellToken,
      );
      let tokenUnitAmount = Number(token_in_wallet.uiAmount*tokenAmountPercentage) * 10 ** tokenDecimal;
      const { minAmountOut: _minAmountOut } = await getAmountOut(
        raydium,
        clmmPoolInfomation.poolInfo,
        clmmPoolInfomation.clmmPoolInfo,
        new BN(tokenUnitAmount),
        clmmPoolInfomation.tickCache,
        SLIPPAGE / 100,
        true,
        sellToken
      );
      const solAmount = Number(_minAmountOut.amount.raw) * (1 + SLIPPAGE / 100);
      

      console.log(`
        YOUR WALLET INFO(SELL)
_______________________________________________________________________________________________
|                                      |                                                      |
|          Current wallet SOL balance  |                    estimated SOL                     |
|--------------------------------------|------------------------------------------------------|
|             ${(lampAmount / 10 ** 9).toFixed(10)}             |                      ${(solAmount / 10 ** 9 + BUFFER).toFixed(10)}                    |   
|______________________________________|______________________________________________________|
`);


      if (lampAmount / LAMPORTS_PER_SOL < 0.00015) {
        walletArray = [...walletArray.filter((item, index) => index !== i)];

        walletAmount--;
        i--;
      } else {
          const { remainingAccounts } = await getAmountOut(
            raydium,
            clmmPoolInfomation.poolInfo,
            clmmPoolInfomation.clmmPoolInfo,
            new BN(tokenUnitAmount),
            clmmPoolInfomation.tickCache,
            SLIPPAGE / 100,
            true,
            sellToken
          );
          let latestBlockhash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash();
          const txId = await makeSwapTransaction(
            connection,
            latestBlockhash,
            raydium,
            clmmPoolInfomation.poolInfo,
            clmmPoolInfomation.clmmPoolInfo,
            clmmPoolInfomation.poolKeys,
            new BN(tokenUnitAmount),
            new BN(1),
            remainingAccounts,
            'SELL',
          );
          if (txId !== '') {
            logger.info(`   SOL/TOKEN state after buying :    +${(solAmount / 10 ** 9 + BUFFER).toFixed(10)} SOL / -${tokenAmountPercentage*token_in_wallet.uiAmount} TOKEN   `);
            logger.info(` You can track in this explorer :    https://solscan.io/tx/${txId}`);
            return 1;
          }
        
      }
    }


  } catch (error: any) {
    console.log(error);
  }
};

main();
