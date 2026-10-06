import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Constructions } from './constructions';

describe('Constructions', () => {
  let component: Constructions;
  let fixture: ComponentFixture<Constructions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Constructions],
    }).compileComponents();

    fixture = TestBed.createComponent(Constructions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
