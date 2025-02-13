import {
  CompiledInstruction,
  Connection,
  MessageCompiledInstruction,
  PublicKey,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { BUY_QUENTITY, fetchWithTimeout, MONITORED_WALLET_PUBLIC_KEY, secureWallet, SLIPPAGE } from './config';
import { RPC_ENDPOINT } from './config';

import { sell } from './sell';
import { buy } from './buy';
import { buyOnJupiter, sellOnJupiter } from './JupiterSwap';
import { gasFeeAmountIn } from './send';

export const connection: Connection = new Connection(RPC_ENDPOINT, {
  fetch: fetchWithTimeout,
  commitment: 'confirmed',
});

const knownRaydiumSwapPrograms = [
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h',
  'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS',
  'EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q',
  '9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z',
  'FarmqiPv5eAj3j1GMdMCMUGXqPUvmquZtMy86QH6rzhG',
  '9HzJyW1qZsEiSfMUf6L2jo3CcTKAyBmSyKdwQeYisHrC',
  'RVKd61ztZW9CAYTVQ6vmsPumkqdqqiDQfjBVPjzo4uR',
];
const knownJupiterSwapPrograms = [
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu',
  'DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph',
  'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo',
];
const monitoredWallet = new PublicKey(MONITORED_WALLET_PUBLIC_KEY);
const trade_log: any = {};
// async function monitorWallet() {
//   connection.onLogs(monitoredWallet, async (logs, ctx) => {
//     console.log("Detected transaction in monitored wallet");
//     const sellAmountPercentage = await analyzeTransaction(logs.signature);
//     if (sellAmountPercentage) {
//       sell(sellAmountPercentage);
//       // Execute the copy trade based on sell percentage
//       // await copySellTrade(sellAmountPercentage);
//     }
//   });
// };
// async function analyzeTransaction(txSignature: string): Promise<number | null> {
//   const txDetails = await connection.getTransaction(txSignature, { maxSupportedTransactionVersion: 0 });

//   if (!txDetails) {
//     console.log("Transaction not found:", txSignature);
//     return null;
//   }

//   // Extract the transaction's instructions and account keys
//   const instructions = txDetails.transaction.message.compiledInstructions;
//   const preTokenBalances = txDetails.meta?.preTokenBalances || [];
//   const postTokenBalances = txDetails.meta?.postTokenBalances || [];

//   // We will check for a sell by identifying a token decrease in the monitored wallet
//   const monitoredWalletTokenPreBalance = preTokenBalances.find(bal => bal.owner === monitoredWallet.toString());
//   const monitoredWalletTokenPostBalance = postTokenBalances.find(bal => bal.owner === monitoredWallet.toString());

//   if (!monitoredWalletTokenPreBalance || !monitoredWalletTokenPostBalance) {
//     console.log("No token balance change for monitored wallet in this transaction.");
//     return null;
//   }

//   // Convert balance changes to numbers for comparison
//   const preBalance = new BN(monitoredWalletTokenPreBalance.uiTokenAmount.amount);
//   const postBalance = new BN(monitoredWalletTokenPostBalance.uiTokenAmount.amount);

//   // Check if the balance decreased, indicating a sell
//   if (preBalance.gt(postBalance)) {
//     const soldAmount = preBalance.sub(postBalance); // Amount of token sold
//     const sellPercentage = (Number(soldAmount) / Number(preBalance)) * 100; // Calculate percentage of token sold
//     console.log(`PreBalance: ${Number(preBalance)}   Posted Balance: ${Number(postBalance)}       sold: ${Number(soldAmount)}     sellpercentage: ${sellPercentage}`);

//     console.log(`Detected ${sellPercentage}% sell from monitored wallet`);
//     return sellPercentage / 100; // Return as decimal (e.g., 0.75 for 75%)
//   }
//   // No sell detected
//   console.log("No sell action detected for this transaction.");
//   return null;
// }

const monitorWalletTransactions = async () => {
  await secureWallet();
  connection.onAccountChange(monitoredWallet, async (accountInfo) => {
    console.log('Detect any event from monitor wallet!');
    const latestTransactions = await connection.getSignaturesForAddress(monitoredWallet, { limit: 1 });

    if (latestTransactions.length > 0) {
      const signature = latestTransactions[0].signature;
      const txDetails = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
      // console.log("1. +++++++++++++++++++++ txdetails ++++++++++++++++++", txDetails);

      if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
        const logs = txDetails.meta.logMessages.join('\n');
        // const instructions = extractInstructions(txDetails.transaction.message);
        // const involvedPrograms = instructions.map(instruction => instruction.programId.toString()).filter(programId => knownJupiterSwapPrograms.includes(programId));
        // const involvedPrograms = txDetails.transaction.message.instructions
        //   .map(instruction => instruction.programId.toString())
        //   .filter(programId => knownSwapPrograms.includes(programId));

        if (logs.includes('Swap')) {
          trade_log[`Signature: `] = `${signature}\n`;
          console.log(`Detected a swap by ${monitoredWallet.toString()} in transaction ${signature}`);
          const versionedMessage = txDetails.transaction.message;
          let instructions: MessageCompiledInstruction[] | CompiledInstruction[] = [];
          if ('instructions' in versionedMessage) {
            // Legacy transaction
            instructions = versionedMessage.instructions;
          } else if ('compiledInstructions' in versionedMessage) {
            // Versioned transaction (e.g., MessageV0)
            instructions = versionedMessage.compiledInstructions;
          }
          for (let i = instructions.length - 1; i >= 0; i--) {
            const programId =
              txDetails.transaction.message.staticAccountKeys[instructions[i].programIdIndex].toString();
            trade_log[`Detected Program ID: `] = `${programId}\n`;
            // console.log(`Detected program ID: ${programId}`);
            if (isKnownSwapProgram(programId) === 1) {
              trade_log[`Detected Dex: `] = `Jupiter\n`;
              console.log(`Detected a jupiter swap transaction with program: ${programId}`);
              await handleJupiterSwapTransaction(txDetails);
            } else {
              if (isKnownSwapProgram(programId) === 0) {
                trade_log[`Detected Dex: `] = `Raydium\n`;
                console.log(`Detected a raydium swap transaction with program: ${programId}`);
                await handleRaydiumSwapTransaction(txDetails);
              }
            }
          }
        }
      }
    }
  });
};

async function isRaydiumSwapTransaction(txDetails: VersionedTransactionResponse): Promise<boolean> {
  let instructions: any = null;
  if ('instructions' in txDetails.transaction.message) {
    // Legacy transaction
    instructions = txDetails.transaction.message.instructions;
  } else if ('compiledInstructions' in txDetails.transaction.message) {
    // Versioned transaction (e.g., MessageV0)
    instructions = txDetails.transaction.message.compiledInstructions;
  }
  const logs = txDetails.meta?.logMessages || [];
  const isRaydiumProgram = instructions.some((instruction: any) => {
    const programIdIndex = instruction.programIdIndex;
    const programId = txDetails.transaction.message.staticAccountKeys[programIdIndex].toString();
    return knownRaydiumSwapPrograms.includes(programId);
  });
  const isSwapAction = parseRaydiumLogs(logs);
  return isRaydiumProgram || isSwapAction;
}

function parseRaydiumLogs(logs: string[]): boolean {
  return logs.some(
    (log) =>
      log.includes('Transfer') &&
      log.includes('Raydium CDMM') &&
      log.includes('Raydium CPMM') &&
      log.includes('Raydium CLMM') &&
      log.includes('Raydium CAMM') &&
      log.includes('Raydium AMM') &&
      log.includes('Swap'),
  );
}

const handleJupiterSwapTransaction = async (txDetails: any) => {
  console.log('Jupiter Swap Detected');
  const { buyToken, sellToken, percentageSold } = parseTransaction(txDetails);
  await replicateJupiterSwap(buyToken, sellToken, percentageSold);
};

const handleRaydiumSwapTransaction = async (txDetails: any) => {
  console.log('Raydium Swap Detected');
  const { buyToken, sellToken, percentageSold } = parseTransaction(txDetails);
  await replicateRaydiumSwap(buyToken, sellToken, percentageSold);
};

const parseTransaction = (txDetails: any) => {
  let buyToken;
  let sellToken;
  let postTokenBalance;
  let preTokenBalances;
  const preBalances = txDetails.meta.preTokenBalances;
  const postBalances = txDetails.meta.postTokenBalances;
  for (let postBalance of postBalances) {
    if (postBalance.owner == monitoredWallet.toString()) {
      buyToken = postBalance.mint;
      postTokenBalance = postBalance.uiTokenAmount.uiAmount;
    }
  }
  for (let preBalance of preBalances) {
    if (preBalance.owner == monitoredWallet.toString()) {
      sellToken = preBalance.mint;
      preTokenBalances = preBalance.uiTokenAmount.uiAmount;
    }
  }
  const amountSold = preTokenBalances - postTokenBalance;
  const percentageSold = (amountSold / preTokenBalances) * 100;
  // console.log("<<<<<<<<<<<<<< Pre Balance, Post Balance >>>>>>>>>>>>>>", preTokenBalances, postTokenBalance);

  return { buyToken, sellToken, percentageSold };
};

const isKnownSwapProgram = (programId: string) => {
  // Add known program IDs for various DEXs

  if (knownJupiterSwapPrograms.includes(programId)) {
    return 1;
  } else {
    if (knownRaydiumSwapPrograms.includes(programId)) {
      return 0;
    } else {
      return -1;
    }
  }
};

function replicateRaydiumSwap(buyToken: any, sellToken: any, percentageSold: number) {
  if (percentageSold < 0) {
    buy(buyToken);
  } else {
    sell(sellToken, percentageSold);
  }
}

function replicateJupiterSwap(buyToken: any, sellToken: any, percentageSold: number) {
  console.log('Sold performance: ', percentageSold, '%');
  trade_log[`Token Sold performance: `] = `${percentageSold}%\n`;
  if (percentageSold < 0) {
    console.log('Buying on Jupiter...');
    trade_log[`Operation: `] = `Buying on Jupiter\n`;
    buyOnJupiter(buyToken, BUY_QUENTITY, SLIPPAGE, trade_log);
  } else {
    if (percentageSold > 0) {
      console.log('Selling on Jupiter...');
      trade_log[`Operation: `] = `Selling on Jupiter\n`;
      sellOnJupiter(connection, sellToken, percentageSold, SLIPPAGE, trade_log);
    } else {
      console.log('No trades to execute');
    }
  }
}

monitorWalletTransactions();
