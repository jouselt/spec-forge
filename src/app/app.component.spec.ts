import { Component } from '@angular/core';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('should create', () => {
    const component = new AppComponent();
    expect(component).toBeTruthy();
  });

  it('should have title property', () => {
    const component = new AppComponent();
    expect(component.title).toBe('spec-forge');
  });
});

