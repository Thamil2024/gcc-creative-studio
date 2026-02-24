import { Component, Input } from '@angular/core';

@Component({
  selector: 'studio-button',
  templateUrl: './studio-button.component.html',
  styleUrls: ['./studio-button.component.scss'],
})
export class StudioButtonComponent {
  @Input() variant: 'primary' | 'cta' = 'primary';
  @Input() shape: 'pill' | 'circle' = 'pill'; 
  @Input() size: 'small' | 'medium' | 'large' | 'none' = 'none';
  @Input() disabled: boolean = false;


  get classes(): string {
    const classList = [];
    
    if (this.variant === 'cta') {
      classList.push('btn-cta');
    } else {
      classList.push('btn-glass-primary');
    }
    
    if (this.shape === 'circle') {
      classList.push('btn-glass-circle');
    }

    if (this.size !== 'none') {
      classList.push(`btn-${this.size}`);
    }
    
    return classList.join(' ');
  }
}
