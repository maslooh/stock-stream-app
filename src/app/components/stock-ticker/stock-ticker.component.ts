// stock-ticker.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockStreamService } from '../../services/stock-stream.service';

@Component({
  selector: 'app-stock-ticker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-ticker.component.html',
  styleUrl: './stock-ticker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockTickerComponent {
  readonly stream = inject(StockStreamService);

  readonly initialData = new Map<
    string,
    { price: number; isPositive: boolean }
  >([
    ['AAPL', { price: 0, isPositive: true }],
    ['MSFT', { price: 0, isPositive: true }],
    ['GOOG', { price: 0, isPositive: true }],
    ['AMZN', { price: 0, isPositive: true }],
  ]);

  readonly allSymbols = Array.from(this.initialData.keys());

  private readonly _symbols = signal<string[]>([
    'AAPL',
    'MSFT',
    'GOOG',
    'AMZN',
  ]);

  private readonly _lastLiveData = new Map<string, any>();

  readonly cards = computed(() => {
    const prices = this.stream.prices();
    const staticInfo = this.stream.staticInfo();
    const activeSymbols = this._symbols();

    return this.allSymbols.map((symbol) => {
      const currentLiveData = prices[symbol];
      let cachedData = this._lastLiveData.get(symbol);

      if (currentLiveData) {
        if (!cachedData || cachedData.timestamp !== currentLiveData.timestamp) {
          const previousPrice = cachedData ? cachedData.price : currentLiveData.price;
          const tickChange = currentLiveData.price - previousPrice;
          
          cachedData = {
            ...currentLiveData,
            displayChange: tickChange
          };
          this._lastLiveData.set(symbol, cachedData);
        }
      }

      const liveData = cachedData;
      const staticData = staticInfo[symbol];
      const baseline = this.initialData.get(symbol)!;
      const isOn = activeSymbols.includes(symbol);

      const currentPrice = liveData ? liveData.price : baseline.price;
      
      // Calculate change using our updated lastLiveData cache (tick-by-tick)
      const displayChange = liveData?.displayChange || 0;

      const isPositive = displayChange >= 0;
      
      const previousPrice = currentPrice - displayChange;
      const changePercent = previousPrice
        ? (Math.abs(displayChange) / previousPrice) * 100
        : 0;

      return {
        symbol,
        name: staticData?.name || symbol,
        price: currentPrice,
        change: displayChange,
        changePercent,
        isPositive,
        isOn,
        volume: liveData ? liveData.volume : '-',
        lastTrade: liveData ? liveData.updatedAt : '-',
        dailyHigh: staticData?.dailyHigh || 0,
        dailyLow: staticData?.dailyLow || 0,
        week52High: staticData?.fiftyTwoWeekHigh || 0,
        week52Low: staticData?.fiftyTwoWeekLow || 0,
      };
    });
  });

  constructor() {
    for (const symbol of this._symbols()) {
      this.stream.subscribe(symbol);
    }
  }

  toggleSymbol(symbol: string): void {
    const current = this._symbols();
    if (current.includes(symbol)) {
      this._symbols.update((c) => c.filter((s) => s !== symbol));
      this.stream.unsubscribe(symbol);
    } else {
      this._symbols.update((c) => [...c, symbol]);
      this.stream.subscribe(symbol);
    }
  }
}
