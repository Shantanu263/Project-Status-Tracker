import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { ProjectService } from '../../services/project.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Project } from '../../models/project.model';
import { UserManagementService, User } from '../../services/user-management.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, catchError, of } from 'rxjs';

interface Template {
  id: number;
  name: string;
  description: string;
  icon: string;
}

interface Member {
  email: string;
  role: string;
  initials: string;
  color: string;
}

interface CustomPhase {
  name: string;
  status: 'pending' | 'adding' | 'success' | 'error';
  errorMessage?: string;
}

@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-project.html',
  styleUrl: './create-project.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateProjectModalComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<CreateProjectModalComponent>);
  private readonly projectService = inject(ProjectService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  private userManagementService = inject(UserManagementService);

  projectForm: FormGroup;
  memberForm: FormGroup;
  customPhaseForm: FormGroup;
  members = signal<Member[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  // 3-step stepper state
  currentStep = signal<1 | 2 | 3>(1);
  projectId = signal<number | null>(null);
  projectName = signal<string>('');
  projectStartDate = signal<string>('');
  projectEndDate = signal<string>('');
  selectedTemplateId = signal<number | null>(null);
  membersBeingAdded = signal(0);

  // Custom phases state
  showCustomPhases = signal(false);
  customPhases = signal<CustomPhase[]>([]);
  isAddingPhase = signal(false);

  // Autocomplete state
  userSuggestions = signal<User[]>([]);
  showDropdown = signal(false);
  isSearchingUsers = signal(false);
  
  private destroy$ = new Subject<void>();
  private emailSearch$ = new Subject<string>();

  templates: Template[] = [
    {
      id: 1,
      name: 'SDLC',
      description: 'Software Development Life Cycle with planning, development, testing, and deployment phases',
      icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'
    },
    {
      id: 2,
      name: 'Research Project',
      description: 'Academic research workflow with literature review, methodology, data collection, and analysis',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
    },
    {
      id: 3,
      name: 'Construction Project',
      description: 'Construction management with design, procurement, construction, and handover phases',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
    }
  ];

  // private readonly PROJECT_HEAD_ID = '7';
  private readonly gradientColors = [
    'from-[#8c2d1b] to-[#6b2115]',
    'from-green-500 to-teal-600',
    'from-pink-500 to-rose-600',
    'from-orange-500 to-red-600',
    'from-blue-500 to-cyan-600',
  ];

  constructor() {
    // Step 1 form - only project details
    this.projectForm = this.fb.group({
      projectName: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      description: [''],
      status: ['ongoing'], // Default status
      priority: ['Medium'], // Default priority
      client: ['']
    });

    this.memberForm = this.fb.group({
      memberEmail: [''],
      memberRole: ['PROJECT_HANDLER'],
    });

    this.customPhaseForm = this.fb.group({
      phaseName: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Debounce email field changes → search registered users
    this.emailSearch$.pipe(
      debounceTime(300),
      // distinctUntilChanged() removed to fix issue when re-typing the same character after pressing backspace
      switchMap(query => this.userManagementService.getUsers(0, 8, 'name', 'asc', query).pipe(
          catchError(() => of(null))
      )),
      takeUntil(this.destroy$)
    ).subscribe(response => {
      if (response) {
          const existingEmails = new Set([
              ...this.members().map(m => m.email)
          ]);
          const filtered = response.content.filter(u => !existingEmails.has(u.email));
          this.userSuggestions.set(filtered);
          if (filtered.length === 0) {
              this.showDropdown.set(false);
          }
      } else {
          this.userSuggestions.set([]);
          this.showDropdown.set(false);
      }
      this.isSearchingUsers.set(false);
      this.cdr.markForCheck();
    });

    // Hook into form control value changes
    this.memberForm.get('memberEmail')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value: string) => {
          const q = (value || '').trim();
          if (q.length >= 1) {
              this.isSearchingUsers.set(true);
              this.showDropdown.set(true);
              this.emailSearch$.next(q);
          } else {
              this.userSuggestions.set([]);
              this.showDropdown.set(false);
              this.isSearchingUsers.set(false);
          }
          this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
      this.showDropdown.set(false);
      this.cdr.markForCheck();
  }

  close() {
    this.dialogRef.close();
  }

  // Step 1: Create Project (without template)
  onCreateProject() {
    console.log('=== onCreateProject called ===');
    if (this.projectForm.invalid) {
      console.warn('Project form is invalid');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.cdr.markForCheck();

    const formValue = this.projectForm.value;
    const payload = {
      projectName: formValue.projectName,
      description: formValue.description,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      // projectHeadId: this.PROJECT_HEAD_ID,
      status: formValue.status,
      priority: formValue.priority,
      client: formValue.client || undefined
    };

    console.log('Submitting project payload:', payload);

    this.projectService.createProject(payload as any).subscribe({
      next: (response) => {
        console.log('Project created successfully:', response);
        this.projectId.set(response.projectId);
        console.log(this.projectId)
        this.projectName.set(formValue.projectName);
        this.projectStartDate.set(formValue.startDate);
        this.projectEndDate.set(formValue.endDate);
        console.log(this.projectName)
        this.isLoading.set(false);
        this.cdr.markForCheck();

        // Step 2 - Template Selection
        this.currentStep.set(2);
        this.cdr.markForCheck();
        this.snackBar.open(`Project "${formValue.projectName}" created successfully!`, 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
        });
      },
      error: (error) => {
        console.error('Error creating project:', error);
        this.errorMessage.set('Failed to create project. Please try again.');
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  // Step 2: Toggle Template Selection (without applying)
  selectTemplate(templateId: number) {
    console.log('selectTemplate called with templateId:', templateId);
    // Toggle selection - if already selected, deselect it
    if (this.selectedTemplateId() === templateId) {
      console.log('Deselecting template');
      this.selectedTemplateId.set(null);
    } else {
      console.log('Selecting template:', templateId);
      this.selectedTemplateId.set(templateId);
    }
    this.cdr.markForCheck();
  }

  // Apply the selected template and move to next step
  applySelectedTemplate() {
    console.log('=== applySelectedTemplate called ===');
    const pId = this.projectId();
    const templateId = this.selectedTemplateId();

    console.log('Project ID:', pId);
    console.log('Template ID:', templateId);

    if (!pId || !templateId) {
      console.warn('Missing projectId or templateId');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.cdr.markForCheck();

    console.log(`Applying template ${templateId} to project ${pId}`);

    this.projectService.applyTemplateToProject(pId, templateId).subscribe({
      next: (response) => {
        console.log('Template applied successfully:', response);
        this.isLoading.set(false);
        this.cdr.markForCheck();

        // Move to Step 3 - Member Assignment
        this.currentStep.set(3);
        this.cdr.markForCheck();
        const templateName = this.templates.find(t => t.id === templateId)?.name || 'Template';
        this.snackBar.open(`${templateName} applied successfully!`, 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
        });
      },
      error: (error) => {
        console.error('Error applying template:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        console.error('Error details:', error.error);

        let errorMsg = 'Failed to apply template. ';
        if (error.status === 404) {
          errorMsg += 'Template or project not found.';
        } else if (error.status === 400) {
          errorMsg += 'Invalid request.';
        } else if (error.status === 0) {
          errorMsg += 'Cannot connect to server. Is the backend running?';
        } else {
          errorMsg += error.error?.message || error.message || 'Please try again.';
        }

        this.errorMessage.set(errorMsg);
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  // Custom Phases Methods
  toggleCustomPhases() {
    const newValue = !this.showCustomPhases();
    this.showCustomPhases.set(newValue);

    // Reset selection when toggling
    if (newValue) {
      this.selectedTemplateId.set(null);
    }

    this.cdr.markForCheck();
  }

  addCustomPhase() {
    if (this.customPhaseForm.invalid) return;

    const phaseName = this.customPhaseForm.get('phaseName')?.value?.trim();
    if (!phaseName) return;

    const pId = this.projectId();
    const startDate = this.projectStartDate();
    const endDate = this.projectEndDate();

    if (!pId || !startDate || !endDate) {
      this.errorMessage.set('Missing project information. Please go back to Step 1.');
      return;
    }

    // Add phase to list with pending status
    const newPhase: CustomPhase = {
      name: phaseName,
      status: 'adding'
    };

    this.customPhases.update(phases => [...phases, newPhase]);
    this.customPhaseForm.reset();
    this.isAddingPhase.set(true);
    this.cdr.markForCheck();

    // Call API to create phase
    const payload = {
      phaseName: phaseName,
      startDate: startDate,
      endDate: endDate
    };

    console.log('Creating custom phase:', payload);

    this.projectService.createPhase(pId, payload as any).subscribe({
      next: (response) => {
        console.log('Phase created successfully:', response);

        // Update phase status to success
        this.customPhases.update(phases =>
          phases.map(p =>
            p.name === phaseName && p.status === 'adding'
              ? { ...p, status: 'success' as const }
              : p
          )
        );

        this.isAddingPhase.set(false);
        this.cdr.markForCheck();

        this.snackBar.open(`Phase "${phaseName}" added successfully!`, 'Close', {
          duration: 2000,
          horizontalPosition: 'center',
        });
      },
      error: (error) => {
        console.error('Error creating phase:', error);

        // Update phase status to error
        this.customPhases.update(phases =>
          phases.map(p =>
            p.name === phaseName && p.status === 'adding'
              ? { ...p, status: 'error' as const, errorMessage: error.error?.message || 'Failed to create phase' }
              : p
          )
        );

        this.isAddingPhase.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  removeCustomPhase(index: number) {
    this.customPhases.update(phases => phases.filter((_, i) => i !== index));
    this.cdr.markForCheck();
  }

  proceedWithCustomPhases() {
    const successfulPhases = this.customPhases().filter(p => p.status === 'success');

    if (successfulPhases.length === 0) {
      this.errorMessage.set('Please add at least one custom phase before proceeding.');
      return;
    }

    // Move to Step 3
    this.currentStep.set(3);
    this.cdr.markForCheck();

    this.snackBar.open(`${successfulPhases.length} custom phase(s) added!`, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
    });
  }

  hasSuccessfulCustomPhases(): boolean {
    return this.customPhases().some(p => p.status === 'success');
  }

  // Step 3: Add Members
  selectSuggestion(user: User, event: Event): void {
    event.stopPropagation();
    // Patch without triggering another search by temporarily unsubscribing via distinct
    this.memberForm.patchValue({ memberEmail: user.email });
    this.userSuggestions.set([]);
    this.showDropdown.set(false);
    this.errorMessage.set('');
    this.cdr.markForCheck();
  }

  onEmailFieldClick(event: Event): void {
      event.stopPropagation();
      if (this.userSuggestions().length > 0) {
          this.showDropdown.set(true);
          this.cdr.markForCheck();
      }
  }

  getUserInitials(user: User): string {
      const parts = user.name.trim().split(' ');
      if (parts.length >= 2) {
          return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      }
      return user.name.charAt(0).toUpperCase();
  }

  getUserAvatarGradient(index: number): string {
      const gradients = [
          'from-purple-500 to-pink-500',
          'from-blue-500 to-cyan-500',
          'from-green-500 to-teal-500',
          'from-orange-500 to-red-500',
          'from-pink-500 to-rose-500'
      ];
      return gradients[index % gradients.length];
  }

  getGlobalRoleColorClass(role: string): string {
      const colorMap: Record<string, string> = {
          'SUPER ADMIN': 'bg-purple-100 text-purple-800',
          'ADMIN': 'bg-blue-100 text-blue-800',
          'MEMBER': 'bg-gray-100 text-gray-800'
      };
      return colorMap[role] || 'bg-gray-100 text-gray-800';
  }

  addMember() {
    console.log('addMember called');
    const email = this.memberForm.get('memberEmail')?.value?.trim();
    console.log('Email:', email);
    if (!email || !email.includes('@')) {
      console.warn('Invalid email');
      return;
    }

    const role = this.memberForm.get('memberRole')?.value;
    console.log('Role:', role);
    const initials = email.substring(0, 2).toUpperCase();
    const color = this.gradientColors[Math.floor(Math.random() * this.gradientColors.length)];
    const newMember: Member = {
      email,
      role,
      initials,
      color
    };

    console.log('Adding member:', newMember);
    this.members.update(m => [...m, newMember]);
    this.memberForm.patchValue({ memberEmail: '' });
    this.userSuggestions.set([]);
    this.showDropdown.set(false);
    this.cdr.markForCheck();
  }

  removeMember(index: number) {
    this.members.update(m => m.filter((_, i) => i !== index));
  }

  finishAndAddMembers() {
    console.log('=== finishAndAddMembers called ===');
    const pId = this.projectId();
    console.log('Project ID:', pId);
    if (!pId) {
      console.warn('No project ID available');
      return;
    }

    const membersList = this.members();
    console.log('Members to add:', membersList);

    if (membersList.length === 0) {
      // No members to add, just close the modal
      console.log('No members to add, closing modal');
      this.snackBar.open('Project creation completed!', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
      });
      this.dialogRef.close({ projectId: pId, projectName: this.projectName() });
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.membersBeingAdded.set(0);
    this.cdr.markForCheck();

    console.log(`Starting to add ${membersList.length} members`);

    // Add members sequentially
    let successCount = 0;
    let failureCount = 0;
    let completed = 0;

    membersList.forEach((member, index) => {
      console.log(`Adding member ${index + 1}/${membersList.length}: ${member.email}`);

      this.projectService.addMemberToProject(pId, member.email, member.role).subscribe({
        next: () => {
          console.log(`✓ Member ${member.email} added successfully`);
          successCount++;
          completed++;
          this.membersBeingAdded.set(completed);
          this.cdr.markForCheck();

          if (completed === membersList.length) {
            console.log(`All members processed. Success: ${successCount}, Failed: ${failureCount}`);
            this.isLoading.set(false);
            this.cdr.markForCheck();
            this.snackBar.open(
              `${successCount} member(s) added successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}!`,
              'Close',
              { duration: 3000, horizontalPosition: 'center' }
            );
            this.dialogRef.close({ projectId: pId, projectName: this.projectName() });
          }
        },
        error: (error) => {
          console.error(`✗ Error adding member ${member.email}:`, error);
          failureCount++;
          completed++;
          this.membersBeingAdded.set(completed);
          this.cdr.markForCheck();

          if (completed === membersList.length) {
            console.log(`All members processed. Success: ${successCount}, Failed: ${failureCount}`);
            this.isLoading.set(false);
            this.cdr.markForCheck();
            this.snackBar.open(
              `${successCount} member(s) added successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}!`,
              'Close',
              { duration: 3000, horizontalPosition: 'center' }
            );
            this.dialogRef.close({ projectId: pId, projectName: this.projectName() });
          }
        }
      });
    });
  }

  // Navigation methods
  previousStep() {
    const current = this.currentStep();
    if (current > 1) {
      this.currentStep.set((current - 1) as 1 | 2 | 3);
      this.errorMessage.set('');
    }
  }

  skipTemplateSelection() {
    // Skip template selection and move to Step 3
    this.currentStep.set(3);
    this.selectedTemplateId.set(null);
  }
}
