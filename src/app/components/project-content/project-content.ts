import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectedProjectService } from '../../services/selected-project.service';
import { signal, computed } from '@angular/core';
import { BoardComponent } from '../board/board';
import { MembersComponent } from '../members/members';
import { DashboardComponent } from '../dashboard/dashboard';
import { PhasesComponent } from '../phases/phases';
import { TimelineComponent } from '../timeline/timeline';

type TabType = 'summary' | 'board' | 'phases' | 'tasks' | 'members' | 'timeline' | 'calendar';

@Component({
  selector: 'app-project-content',
  imports: [CommonModule, BoardComponent, MembersComponent, DashboardComponent, PhasesComponent, TimelineComponent],
  templateUrl: './project-content.html',
  styleUrl: './project-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectContentComponent {
  private readonly selectedProjectService = inject(SelectedProjectService);

  activeTab = signal<TabType>('summary');
  selectedProject = computed(() => this.selectedProjectService.getSelectedProject()());

  tabs: { label: string; value: TabType }[] = [
    { label: 'Summary', value: 'summary' },
    { label: 'Board', value: 'board' },
    { label: 'Phases', value: 'phases' },
    { label: 'Tasks', value: 'tasks' },
    { label: 'Members', value: 'members' },
    { label: 'Timeline', value: 'timeline' },
    { label: 'Calendar', value: 'calendar' }
  ];

  selectTab(tab: TabType) {
    this.activeTab.set(tab);
  }
}
