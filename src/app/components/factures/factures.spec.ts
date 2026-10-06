import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Factures } from './factures';

describe('Factures', () => {
  let component: Factures;
  let fixture: ComponentFixture<Factures>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Factures],
    }).compileComponents();

    fixture = TestBed.createComponent(Factures);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
