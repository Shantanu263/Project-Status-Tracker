import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Phases } from './phases';

describe('Phases', () => {
  let component: Phases;
  let fixture: ComponentFixture<Phases>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Phases]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Phases);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
