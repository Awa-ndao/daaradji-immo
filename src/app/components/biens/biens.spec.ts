import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Biens } from './biens';

describe('Biens', () => {
  let component: Biens;
  let fixture: ComponentFixture<Biens>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Biens],
    }).compileComponents();

    fixture = TestBed.createComponent(Biens);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
