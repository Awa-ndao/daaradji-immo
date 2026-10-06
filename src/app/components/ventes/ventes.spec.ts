import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Ventes } from './ventes';

describe('Ventes', () => {
  let component: Ventes;
  let fixture: ComponentFixture<Ventes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ventes],
    }).compileComponents();

    fixture = TestBed.createComponent(Ventes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
