import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectsDashboard } from './projects-dashboard';

describe('ProjectsDashboard', () => {
  let component: ProjectsDashboard;
  let fixture: ComponentFixture<ProjectsDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectsDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
