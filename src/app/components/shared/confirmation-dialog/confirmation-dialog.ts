import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-confirmation-dialog',
    imports: [CommonModule],
    templateUrl: './confirmation-dialog.html',
    styleUrl: './confirmation-dialog.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationDialogComponent {
    isOpen = input.required<boolean>();
    title = input<string>('Confirm Action');
    message = input<string>('Are you sure you want to proceed?');
    confirmText = input<string>('Confirm');
    cancelText = input<string>('Cancel');
    isDanger = input<boolean>(true);

    confirm = output<void>();
    cancel = output<void>();

    onConfirm(): void {
        this.confirm.emit();
    }

    onCancel(): void {
        this.cancel.emit();
    }

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.cancel.emit();
        }
    }
}
