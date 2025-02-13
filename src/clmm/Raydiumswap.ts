import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  ComputeClmmPoolInfo,
  PoolUtils,
  ReturnTypeFetchMultiplePoolTickArrays,
  ApiV3Token,
  TickArray,
  Raydium,
} from '@raydium-io/raydium-sdk-v2';
import {
  VersionedTransaction,
  BlockhashWithExpiryBlockHeight,
  Transaction,
  Connection,
  PublicKey,
  Signer,
  Keypair,
  ComputeBudgetInstruction,
} from '@solana/web3.js';

import BN from 'bn.js';
import {
  initSdk,
  logger,
  isValidClmm,
  sleep,
  getWallet,
  txVersion,
  RPC_ENDPOINT,
  POOL_ADDRESS,
  COMPUTE_UNIT_LIMIT,
  COMPUTE_UNIT_PRICE,
} from '../config';
import { getPoolID } from '../RaydimSwap/replicateRaydiumSwap';
const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";

export const getPoolInfo = async (connection: Connection, wallet: Keypair, baseTokenAdress: string) => {
  const poolId  = await getPoolID(baseTokenAdress);
  if(poolId == " null")
    return null;
  const raydium = await initSdk(connection, wallet, 'mainnet');
  let poolInfo;
  let poolKeys;
  let clmmPoolInfo;
  let tickCache;

  if (raydium.cluster === 'mainnet') {
    const data = await raydium.api.fetchPoolByMints({ mint1: WSOL_ADDRESS, mint2: baseTokenAdress });
    poolInfo = data[0] as ApiV3PoolInfoConcentratedItem;
    // if (!isValidClmm(poolInfo.programId)) throw new Error('target pool is not CLMM pool');
    clmmPoolInfo = await PoolUtils.fetchComputeClmmInfo({
      connection: raydium.connection,
      poolInfo,
    });
    tickCache = await PoolUtils.fetchMultiplePoolTickArrays({
      connection: raydium.connection,
      poolKeys: [clmmPoolInfo],
    });
  } else {
    const data = await raydium.clmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
    clmmPoolInfo = data.computePoolInfo;
    tickCache = data.tickData;
  }

  return {
    raydium: raydium,
    poolInfo: poolInfo,
    poolKeys: poolKeys,
    clmmPoolInfo: clmmPoolInfo,
    tickCache: tickCache,
  };
};
export const getAmountOut = async (
  raydium: Raydium,
  poolInfo: ApiV3PoolInfoConcentratedItem,
  clmmPoolInfo: ComputeClmmPoolInfo,
  tokenAmount: BN,
  tickCache: ReturnTypeFetchMultiplePoolTickArrays,
  slippage: number,
  flag: boolean = true, //true = sell
  baseTokenAdress: string
) => {
  let tokenOut = flag ? poolInfo.mintA : poolInfo.mintB;
  const poolId  = await getPoolID(baseTokenAdress);
  const { minAmountOut, remainingAccounts } = await PoolUtils.computeAmountOutFormat({
    poolInfo: clmmPoolInfo,
    tickArrayCache: tickCache[poolId],
    amountIn: tokenAmount,
    tokenOut: tokenOut,
    slippage: slippage,
    epochInfo: await raydium.fetchEpochInfo(),
  });
  return {
    minAmountOut,
    remainingAccounts,
  };
};

export const makeSwapTransaction = async (
  connection: Connection,
  latestBlockhash: BlockhashWithExpiryBlockHeight,
  raydium: Raydium,
  poolInfo: ApiV3PoolInfoConcentratedItem,
  clmmPoolInfo: ComputeClmmPoolInfo,
  poolKeys: ClmmKeys | undefined,
  amountIn: BN,
  amountOutMin: BN,
  remainingAccounts: PublicKey[],
  swapMode: 'BUY' | 'SELL' = 'BUY',

) => {
  const inputMint = swapMode === 'BUY' ? poolInfo.mintA.address : poolInfo.mintB.address;

  const { builder, transaction } = await raydium.clmm.swap({
    poolInfo,
    poolKeys,
    inputMint: inputMint,
    amountIn: amountIn,
    amountOutMin: amountOutMin,
    observationId: clmmPoolInfo.observationId,
    ownerInfo: {
      useSOLBalance: true,
    },
    remainingAccounts,
    txVersion,
  });

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: connection.commitment,
  });

  try {
    console.log(".......................................................................................................");
    let result = await confirm(connection, signature, latestBlockhash);
    // const { txId } = await execute({sendAndConfirm: true});
    return result.signature;
  } catch (error) {
    console.log(error);
    return '';
  }
  // builder.addCustomComputeBudget({ units: COMPUTE_UNIT_LIMIT, microLamports: COMPUTE_UNIT_PRICE });
  // const { transaction } = await builder.versionBuild({ txVersion });
  return;
};
export const confirm = async (
  connection: Connection,
  signature: string,
  latestBlockhash: BlockhashWithExpiryBlockHeight,
) => {
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    },
    'confirmed',
  );
  return { confirmed: !confirmation.value.err, signature };
};
export const executeAndConfirm = async (
  connection: Connection,
  transaction: VersionedTransaction,
  latestBlockhash: BlockhashWithExpiryBlockHeight,
): Promise<{ confirmed: boolean; signature?: string; error?: string }> => {
  logger.debug('Executing transaction...');

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: connection.commitment,
  });
  return await confirm(connection, signature, latestBlockhash);
};
