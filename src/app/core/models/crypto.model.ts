export interface ExchangePrice {
  name: string;
  bid: number;
  ask: number;
  price: number;
  status: 'ok' | 'error' | 'not_supported'; // Добавил not_supported, так как он есть в Kotlin
}

export interface TradePoint {
  exchange: string;
  price: number;
}

export interface ExchangeSpread {
  coinSymbol: string;
  buy: TradePoint;
  sell: TradePoint;
  spreadPct: number;
  spreadCash: number;
}

export interface ArbitrageRow {
  exchangeName: string;
  values: { targetExchange: string; diff: number | null }[];
}