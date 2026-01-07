import { Component, input, output, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';

interface MemberToAdd {
    email: string;
    role: string;
    initials: string;
    color: string;
}

@Component({
    selector: 'app-add-members-modal',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-members-modal.html',
    styleUrl: './add-members-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddMembersModalComponent {
    private fb = inject(FormBuilder);
    private projectService = inject(ProjectService);

    // Input/Output
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    close = output<void>();
    membersAdded = output<void>();

    // State
    members = signal<MemberToAdd[]>([]);
    isLoading = signal(false);
    membersBeingAdded = signal(0);
    errorMessage = signal<string | null>(null);

    // Form
    memberForm: FormGroup;

    constructor() {
        this.memberForm = this.fb.group({
            memberEmail: ['', [Validators.required, Validators.email]],
            memberRole: ['PROJECT_HANDLER', Validators.required]
        });
    }

    addMember(): void {
        if (this.memberForm.invalid) return;

        const email = this.memberForm.get('memberEmail')?.value;
        const role = this.memberForm.get('memberRole')?.value;

        // Check if member already exists
        if (this.members().some(m => m.email === email)) {
            this.errorMessage.set('This member has already been added');
            return;
        }

        const initials = this.getInitials(email);
        const color = this.getAvatarGradient(this.members().length);

        this.members.update(members => [...members, { email, role, initials, color }]);
        this.memberForm.patchValue({ memberEmail: '' });
        this.errorMessage.set(null);
    }

    removeMember(index: number): void {
        this.members.update(members => members.filter((_, i) => i !== index));
    }

    async finishAndAddMembers(): Promise<void> {
        const projectId = this.projectId();
        const membersToAdd = this.members();

        if (membersToAdd.length === 0) {
            this.onClose();
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.membersBeingAdded.set(0);

        try {
            for (let i = 0; i < membersToAdd.length; i++) {
                const member = membersToAdd[i];
                await this.projectService.addMemberToProject(
                    projectId,
                    member.email,
                    member.role
                ).toPromise();
                this.membersBeingAdded.set(i + 1);
            }

            this.isLoading.set(false);
            this.membersAdded.emit();
            this.onClose();
        } catch (error) {
            this.isLoading.set(false);
            this.errorMessage.set('Failed to add some members. Please try again.');
            console.error('Error adding members:', error);
        }
    }

    onClose(): void {
        this.members.set([]);
        this.memberForm.reset({ memberRole: 'PROJECT_HANDLER' });
        this.errorMessage.set(null);
        this.close.emit();
    }

    private getInitials(email: string): string {
        const name = email.split('@')[0];
        return name.substring(0, 2).toUpperCase();
    }

    private getAvatarGradient(index: number): string {
        const gradients = [
            'from-indigo-500 to-purple-600',
            'from-blue-500 to-cyan-600',
            'from-pink-500 to-rose-600',
            'from-green-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-yellow-500 to-orange-600',
            'from-emerald-500 to-teal-600'
        ];
        return gradients[index % gradients.length];
    }
}
