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

  readonly cards = computed(() => {
    const prices = this.stream.prices();
    const staticInfo = this.stream.staticInfo();
    const activeSymbols = this._symbols();

    return this.allSymbols.map((symbol) => {
      const liveData = prices[symbol];
      const staticData = staticInfo[symbol];
      const baseline = this.initialData.get(symbol)!;
      const isOn = activeSymbols.includes(symbol);

      const currentPrice = liveData ? liveData.price : baseline.price;
      const change = currentPrice - baseline.price;
      // If it hasn't moved but we assigned a fake isPositive sign for visual mock
      let displayChange = change;
      if (currentPrice === baseline.price) {
        displayChange = 0; // mock change if no live data
      }

      const isPositive = displayChange >= 0;
      const changePercent = baseline.price ? (Math.abs(displayChange) / baseline.price) * 100 : 0;

      return {
        symbol,
        name: staticData?.name || symbol,
        price: currentPrice,
        change: displayChange,
        changePercent,
        isPositive,
        isOn,
        volume: liveData
          ? liveData.volume
          : Math.floor(Math.random() * 5000 + 1000),
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
