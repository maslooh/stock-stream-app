import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockTickerComponent } from "./components/stock-ticker/stock-ticker.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, StockTickerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'stock-stream-app';
}
