// stock-stream.service.ts
import {
  Injectable,
  computed,
  signal,
  WritableSignal,
} from '@angular/core';
import { environment } from '../../environments/environment';
import {
  ConnectionState,
  FinnhubTrade,
  FinnhubTradeMessage,
  StockPriceState,
  StaticStockInfo
} from '../interfaces/stock-stream.interface';

@Injectable({ providedIn: 'root' })
export class StockStreamService {
  private readonly apiKey = environment.finnhubApiKey;
  private readonly wsUrl = `${environment.finnhubWsUrl}?token=${this.apiKey}`;

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = false;

  private readonly _connectionState = signal<ConnectionState>('idle');
  readonly connectionState = this._connectionState.asReadonly();

  private readonly _trackedSymbols = signal<string[]>([]);
  readonly trackedSymbols = this._trackedSymbols.asReadonly();

  private readonly _prices: WritableSignal<Record<string, StockPriceState>> = signal({});
  readonly prices = this._prices.asReadonly();

  private readonly _staticInfo: WritableSignal<Record<string, StaticStockInfo>> = signal({});
  readonly staticInfo = this._staticInfo.asReadonly();

  readonly hasConnection = computed(() => this.connectionState() === 'connected');

  connect(): void {
    if (this.socket && (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    )) {
      return;
    }

    this.manuallyClosed = false;
    this._connectionState.set(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    this.socket = new WebSocket(this.wsUrl);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this._connectionState.set('connected');

      for (const symbol of this._trackedSymbols()) {
        this.send({ type: 'subscribe', symbol });
      }
    };

    this.socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as FinnhubTradeMessage;

        if (payload.type !== 'trade' || !Array.isArray(payload.data)) {
          return;
        }

        this.applyTrades(payload.data);
      } catch (error) {
        console.error('Failed to parse Finnhub message', error);
      }
    };

    this.socket.onerror = () => {
      this._connectionState.set('error');
    };

    this.socket.onclose = () => {
      this.socket = null;

      if (this.manuallyClosed) {
        this._connectionState.set('closed');
        return;
      }

      this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.manuallyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this._connectionState.set('closed');
  }

  subscribe(symbol: string): void {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;

    this.loadStaticInfo(normalized);

    const current = this._trackedSymbols();
    if (!current.includes(normalized)) {
      this._trackedSymbols.set([...current, normalized]);
    }

    this.connect();

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'subscribe', symbol: normalized });
    }
  }

  unsubscribe(symbol: string): void {
    const normalized = symbol.trim().toUpperCase();
    this._trackedSymbols.set(
      this._trackedSymbols().filter((s) => s !== normalized)
    );

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'unsubscribe', symbol: normalized });
    }

    this._prices.update((current) => {
      const next = { ...current };
      delete next[normalized];
      return next;
    });
  }

  clearAll(): void {
    for (const symbol of this._trackedSymbols()) {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'unsubscribe', symbol });
      }
    }

    this._trackedSymbols.set([]);
    this._prices.set({});
    this._staticInfo.set({});
  }

  priceFor(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    return computed(() => this._prices()[normalized] ?? null);
  }

  private applyTrades(trades: FinnhubTrade[]): void {
    this._prices.update((current) => {
      const next = { ...current };

      for (const trade of trades) {
        // If multiple trades arrive in one message, keep the latest timestamp per symbol
        const existing = next[trade.s];
        if (!existing || trade.t >= existing.timestamp) {
          next[trade.s] = {
            symbol: trade.s,
            price: trade.p,
            volume: trade.v,
            timestamp: trade.t,
            updatedAt: new Date(trade.t).toLocaleTimeString(),
          };
        }
      }

      return next;
    });
  }

  private send(message: { type: 'subscribe' | 'unsubscribe'; symbol: string }): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts += 1;

    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 15000);

    this._connectionState.set('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private async loadStaticInfo(symbol: string): Promise<void> {
    if (this._staticInfo()[symbol]) return;

    try {
      const [profileRes, quoteRes, metricRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${this.apiKey}`),
        fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.apiKey}`),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${this.apiKey}`)
      ]);

      const profile = await profileRes.json();
      const quote = await quoteRes.json();
      const metricData = await metricRes.json();
      const metrics = metricData.metric || {};

      this._staticInfo.update(current => ({
        ...current,
        [symbol]: {
          name: profile.name || symbol,
          dailyHigh: quote.h || 0,
          dailyLow: quote.l || 0,
          fiftyTwoWeekHigh: metrics['52WeekHigh'] || 0,
          fiftyTwoWeekLow: metrics['52WeekLow'] || 0
        }
      }));
    } catch (e) {
      console.error('Failure fetching static data for', symbol, e);
    }
  }
}