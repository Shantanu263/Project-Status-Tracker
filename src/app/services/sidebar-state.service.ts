import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarStateService {
  private readonly sidebarOpenSignal = signal(true);

  readonly sidebarOpen = this.sidebarOpenSignal.asReadonly();

  toggleSidebar(): void {
    this.sidebarOpenSignal.update(open => !open);
  }

  setSidebarOpen(isOpen: boolean): void {
    this.sidebarOpenSignal.set(isOpen);
  }
}


