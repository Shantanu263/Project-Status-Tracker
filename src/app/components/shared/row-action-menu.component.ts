/**
 * Row Action Menu Component
 * 
 * This component provides a dropdown menu for row-level actions using Angular CDK Overlay.
 * It's designed to be used in tables where absolute positioning would cause issues.
 * 
 * Key Features:
 * - Renders outside the table DOM (no table reflow)
 * - Auto-flip positioning (shows above if no space below)
 * - Proper z-index management
 * - Backdrop for outside click detection
 * - Keyboard accessibility (Escape to close)
 * - Max height with scrolling for future growth
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';

export interface MenuItem {
    label: string;
    action: () => void;
    icon?: string;
    danger?: boolean;
    submenu?: MenuItem[];
}

@Component({
    selector: 'app-row-action-menu',
    standalone: true,
    imports: [CommonModule, OverlayModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <!-- Menu Trigger Button -->
    <button
      #menuTrigger="cdkOverlayOrigin"
      cdkOverlayOrigin
      (click)="toggleMenu()"
      [class]="triggerClass"
      type="button">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
    </button>

    <!-- CDK Overlay Dropdown -->
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="menuTrigger"
      [cdkConnectedOverlayOpen]="isOpen"
      [cdkConnectedOverlayHasBackdrop]="true"
      [cdkConnectedOverlayBackdropClass]="'cdk-overlay-transparent-backdrop'"
      (backdropClick)="close()"
      (detach)="close()"
      [cdkConnectedOverlayPositions]="overlayPositions">
      
      <div class="w-48 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
        <ng-content></ng-content>
      </div>
    </ng-template>
  `,
    styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class RowActionMenuComponent {
    @Input() triggerClass = 'p-1 rounded hover:bg-gray-200 transition-all duration-200';
    @Output() menuToggle = new EventEmitter<boolean>();

    isOpen = false;

    // Overlay positions with auto-flip
    overlayPositions = [
        {
            // Preferred: bottom-end
            originX: 'end' as const,
            originY: 'bottom' as const,
            overlayX: 'end' as const,
            overlayY: 'top' as const,
            offsetY: 4
        },
        {
            // Fallback: top-end (auto-flip)
            originX: 'end' as const,
            originY: 'top' as const,
            overlayX: 'end' as const,
            overlayY: 'bottom' as const,
            offsetY: -4
        }
    ];

    toggleMenu(): void {
        this.isOpen = !this.isOpen;
        this.menuToggle.emit(this.isOpen);
    }

    close(): void {
        this.isOpen = false;
        this.menuToggle.emit(false);
    }
}
