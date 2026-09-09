import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>spec-forge</h1>
        <p class="tagline">Interview first, generate second, never invent.</p>
      </header>

      <div class="app-layout">
        <aside class="step-rail">
          <nav>
            <!-- Steps will be rendered here -->
          </nav>
        </aside>

        <main class="content-region">
          <!-- Wizard, output, review panels will render here -->
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .app-header {
      background: #1a1a1a;
      color: #fff;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #333;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .app-header h1 {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 600;
    }

    .tagline {
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
      color: #aaa;
    }

    .app-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .step-rail {
      width: 240px;
      background: #f5f5f5;
      border-right: 1px solid #ddd;
      overflow-y: auto;
      padding: 1rem 0;
    }

    .step-rail nav {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0 0.5rem;
    }

    .content-region {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
    }
  `],
})
export class AppComponent {
  title = 'spec-forge';
}
