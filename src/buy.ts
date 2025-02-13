import {
  Connection,
  Keypair,
  PublicKey,
  BlockhashWithExpiryBlockHeight,
} from '@solana/web3.js';
import BN from 'bn.js';
import {
  initSdk,
  logger,
  getWallet,
  getTokenDecimal,
  fetchWithTimeout,
  BUY_QUENTITY,
} from './config';
import {
  RPC_ENDPOINT,
  PROVIDER_PRIVATE_KEY,
  TOKEN_ADDRESS,
  SLIPPAGE,
  NUMBER_OF_WALLETS,
  TRANSACTION_COUNT_PER_BUNDLE,
  JITO_FEE_PAYER_PRIVATE_KEY,
  BUFFER,
} from './config';

import { getPoolInfo, getAmountOut, makeSwapTransaction, executeAndConfirm } from './clmm/Raydiumswap';
import { Raydium } from '@raydium-io/raydium-sdk-v2';
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
for (let i = 0; i < NUMBER_OF_WALLETS; i++) {
  const keypair: Keypair = getWallet(wallets[i].secretKey);
  walletArray = [...walletArray, { wallet: keypair, id: i }];
}

export const buy = async (baseTokenAdress: string) => {  
  try {
    if (!tokenDecimal) {
      tokenDecimal = await getTokenDecimal(connection, new PublicKey(TOKEN_ADDRESS));
    }
    let walletAmount = walletArray.length;
    if (walletAmount === 0) {
      logger.info('Please create a new child wallet.');
      process.exit(1);
    }
    for (let i = 0; i < Math.min(transactionCountPerBundle, walletAmount); i++) {
      if (!clmmPoolInfomation) {
        clmmPoolInfomation = await getPoolInfo(connection, providerWallet, baseTokenAdress);
      }

      const raydium: Raydium = await initSdk(connection, walletArray[i].wallet, 'mainnet');
      // let tokenAmount = getRandomNumber(MIN_BUY_QUANTITY, MAX_BUY_QUANTITY);

      const lampAmount: number = await connection.getBalance(walletArray[i].wallet.publicKey);
      // let tokenUnitAmount = Number(tokenAmount) * 10 ** tokenDecimal;

      const { minAmountOut: _minAmountOut, remainingAccounts } = await getAmountOut(
        raydium,
        clmmPoolInfomation.poolInfo,
        clmmPoolInfomation.clmmPoolInfo,
        new BN(BUY_QUENTITY * 10 ** 9),
        clmmPoolInfomation.tickCache,
        SLIPPAGE / 100,
        false,
        baseTokenAdress
      );
      const solAmount = Number(BUY_QUENTITY) * (1 + SLIPPAGE / 100);

      console.log(`
                              YOUR WALLET INFO(BUY)
 _____________________________________________________________________________________________
|                                      |                                                      |
|          Current wallet SOL balance  |                       Needed SOL                     |
|--------------------------------------|------------------------------------------------------|
|             ${(lampAmount / 10 ** 9).toFixed(10)}             |                      ${(solAmount / 10 ** 9 + BUFFER).toFixed(10)}                    |   
|______________________________________|______________________________________________________|
`);

      if (new BN(lampAmount).lt(new BN(solAmount))) {
        walletArray = [...walletArray.filter((item, index) => index !== i)];
        walletAmount--;
        i--;
        continue;
      } else {
        const { remainingAccounts } = await getAmountOut(
          raydium,
          clmmPoolInfomation.poolInfo,
          clmmPoolInfomation.clmmPoolInfo,
          new BN(solAmount * 10 ** 9),
          clmmPoolInfomation.tickCache,
          SLIPPAGE / 100,
          false,
          baseTokenAdress
        );

        let latestBlockhash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash();
        const txId = await makeSwapTransaction(
          connection,
          latestBlockhash,
          raydium,
          clmmPoolInfomation.poolInfo,
          clmmPoolInfomation.clmmPoolInfo,
          clmmPoolInfomation.poolKeys,
          new BN(solAmount * 10 ** 9),
          new BN(1),
          remainingAccounts,
          'BUY',
        );
        if (txId !== '') {
          logger.info(`   SOL/TOKEN state after buying :  -${(solAmount / 10 ** 9 + BUFFER).toFixed(10)} SOL / +${Number(_minAmountOut.amount.raw) / 10 ** 9} TOKEN   `);
          logger.info(` You can track in this explorer : https://solscan.io/tx/${txId}`);
          return 1;
        }
      }
    }
  } catch (error: any) {
    console.log(error);
  }
};