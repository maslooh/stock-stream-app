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

  symbolInput = '';
  private readonly symbols = signal<string[]>(['AAPL', 'MSFT', 'GOOG', 'AMZN']);

  readonly rows = computed(() => {
    const prices = this.stream.prices();
    return this.symbols()
      .map((symbol) => prices[symbol])
      .filter((row): row is NonNullable<typeof row> => !!row);
  });

  constructor() {
    for (const symbol of this.symbols()) {
      this.stream.subscribe(symbol);
    }
  }

  addSymbol(): void {
    const symbol = this.symbolInput.trim().toUpperCase();
    if (!symbol) return;

    if (!this.symbols().includes(symbol)) {
      this.symbols.update((current) => [...current, symbol]);
      this.stream.subscribe(symbol);
    }

    this.symbolInput = '';
  }

  removeSymbol(symbol: string): void {
    this.symbols.update((current) => current.filter((s) => s !== symbol));
    this.stream.unsubscribe(symbol);
  }

  disconnect(): void {
    this.stream.disconnect();
  }
}
