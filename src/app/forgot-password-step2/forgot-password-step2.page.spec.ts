import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ForgotPasswordStep2Page } from './forgot-password-step2.page';

describe('ForgotPasswordStep2Page', () => {
  let component: ForgotPasswordStep2Page;
  let fixture: ComponentFixture<ForgotPasswordStep2Page>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ForgotPasswordStep2Page ],
      imports: [IonicModule.forRoot(), ReactiveFormsModule, FormsModule, RouterModule.forRoot([])],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordStep2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
