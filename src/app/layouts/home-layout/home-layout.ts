import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { ProjectContentComponent } from '../../components/project-content/project-content';
import { SidebarStateService } from '../../services/sidebar-state.service';

@Component({
  selector: 'app-home-layout',
  imports: [SidebarComponent, ProjectContentComponent],
  template: `
    <div 
      class="home-layout flex flex-col h-screen w-screen bg-gray-100 overflow-hidden"
      [class.sidebar-open]="sidebarOpen()"
      [class.sidebar-closed]="!sidebarOpen()"
    >
      <app-sidebar></app-sidebar>

      <div class="main-area flex flex-1 overflow-hidden pt-20 transition-all duration-300">
        <div class="flex-1 flex flex-col overflow-hidden">
          <app-project-content></app-project-content>
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
