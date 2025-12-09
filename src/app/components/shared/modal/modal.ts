import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-modal',
    imports: [CommonModule],
    templateUrl: './modal.html',
    styleUrl: './modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:keydown.escape)': 'onEscapeKey()'
    }
})
export class ModalComponent {
    isOpen = input.required<boolean>();
    title = input<string>('');
    showCloseButton = input<boolean>(true);

    close = output<void>();

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.close.emit();
        }
    }

    onEscapeKey(): void {
        if (this.isOpen()) {
            this.close.emit();
        }
    }

    onCloseClick(): void {
        this.close.emit();
    }
}
