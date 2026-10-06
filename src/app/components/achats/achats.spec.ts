import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Achats } from './achats';

describe('Achats', () => {
  let component: Achats;
  let fixture: ComponentFixture<Achats>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Achats],
    }).compileComponents();

    fixture = TestBed.createComponent(Achats);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
