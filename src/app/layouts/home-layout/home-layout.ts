import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { SidebarStateService } from '../../services/sidebar-state.service';

@Component({
  selector: 'app-home-layout',
  imports: [SidebarComponent, RouterOutlet],
  template: `
    <div 
      class="home-layout flex flex-col h-screen w-screen bg-gray-100 overflow-hidden"
      [class.sidebar-open]="sidebarOpen()"
      [class.sidebar-closed]="!sidebarOpen()"
    >
      <app-sidebar></app-sidebar>

      <div class="main-area flex flex-1 overflow-hidden pt-17 transition-all duration-300">
        <div class="flex-1 flex flex-col overflow-hidden h-full">
          <div class="h-full">
            <router-outlet></router-outlet>
          </div>
        </div>
      </div>
    </div>
    `,
  styleUrl: './home-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeLayoutComponent {
  private readonly sidebarState = inject(SidebarStateService);
  protected readonly sidebarOpen = this.sidebarState.sidebarOpen;
}
