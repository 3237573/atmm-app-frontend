// src/app/core/models/dex.model.ts

/**
 * Модель сети блокчейна
 */
export interface DexNetwork {
  id: string;              // "ethereum", "arbitrum", etc.
  name: string;            // "Ethereum Mainnet"
  chainId: number;         // 1, 42161, 137, 56
  rpcUrl: string;          // RPC URL для подключения
  nativeCurrency: string;  // "ETH", "BNB", "MATIC"
  explorerUrl: string;     // "https://etherscan.io"
  isEnabled: boolean;      // Активна ли сеть
  logoUrl?: string;        // Путь к иконке
}

/**
 * Модель DEX протокола
 */
export interface DexProtocol {
  id: string;              // "uniswap_v3", "pancakeswap_v3"
  name: string;            // "Uniswap V3"
  logoUrl?: string;
  websiteUrl: string;
  networks: string[];      // Список ID сетей, где работает
}

/**
 * Модель токена
 */
export interface DexToken {
  symbol: string;          // "ETH", "USDC"
  address: string;         // Адрес контракта
  decimals: number;        // 18 для ETH, 6 для USDC
  chainId: number;         // ID сети
  isNative?: boolean;      // Нативный токен (ETH, BNB)
  logoUrl?: string;
}

/**
 * Модель цены с DEX
 */
export interface DexPrice {
  protocol: string;        // "Uniswap V3"
  network: string;         // "Arbitrum"
  pool: string;            // "WETH/USDC 0.3%"
  poolAddress: string;     // Адрес пула
  tokenIn: DexToken;       // Токен входа
  tokenOut: DexToken;      // Токен выхода
  amountIn: string;        // Сумма на входе (BigInt в строке)
  amountOut: string;       // Сумма на выходе (BigInt в строке)
  priceImpact: number;     // Проскальзывание %
  executionPrice: number;  // Фактическая цена
  midPrice: number;        // Средняя цена из пула
  sqrtPriceX96: string;    // Текущая цена (для V3)
  liquidity: string;       // Ликвидность пула
  fee: number;             // Комиссия пула (3000 = 0.3%)
  timestamp: number;       // Время получения
}

/**
 * Точка для арбитража (покупка или продажа)
 */
export interface DexTradePoint {
  protocol: string;
  network: string;
  pool: string;
  price: number;
  liquidityUsd?: number;   // Ликвидность в USD
}

/**
 * Оценка газа
 */
export interface GasEstimate {
  networkId: string;
  gasPriceGwei: number;
  estimatedGasUnits: number;
  totalGasCostEth: number;
  totalGasCostUsd: number;
}

/**
 * Арбитражный спред
 */
export interface DexSpread {
  coinSymbol: string;      // "ETH"
  buy: DexTradePoint;      // Где купить дешевле
  sell: DexTradePoint;     // Где продать дороже
  spreadPct: number;       // Спред в %
  spreadCash: number;      // Прибыль в USD (для $1000)
  estimatedGas: GasEstimate;
  network: string;         // Сеть
  timestamp?: number;      // Время обнаружения
}

/**
 * Результат выполнения арбитража
 */
export interface ArbitrageResult {
  txHash: string;          // Хэш транзакции
  networkId: string;
  buyAmount: string;
  sellAmount: string;
  profit: number;
  profitPct: number;
  explorerUrl: string;     // Ссылка на транзакцию
  timestamp: number;
}

/**
 * Статус кошелька
 */
export interface WalletInfo {
  address: string;
  chainId: number;
  balance: string;
  isConnected: boolean;
}
