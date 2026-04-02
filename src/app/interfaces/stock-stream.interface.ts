export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error';

export interface FinnhubTrade {
  p: number;      // last price
  s: string;      // symbol
  t: number;      // unix ms timestamp
  v: number;      // volume
  c?: string[];   // conditions (optional)
}

export interface FinnhubTradeMessage {
  type: string;
  data?: FinnhubTrade[];
}

export interface StockPriceState {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  updatedAt: string;
}
