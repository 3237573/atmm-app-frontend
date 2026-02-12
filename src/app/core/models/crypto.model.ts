export interface ExchangePrice {
  name: string;
  price: number;
  status: 'ok' | 'error';
}

export interface ArbitrageRow {
  exchangeName: string;
  values: { targetExchange: string; diff: number | null }[];
}