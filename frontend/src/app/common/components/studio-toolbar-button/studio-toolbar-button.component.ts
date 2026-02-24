import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'studio-toolbar-button',
  template: `
    <button mat-button class="glass-toolbar-btn" [class.active]="active" [disabled]="disabled" (click)="onClick.emit($event)">
      <ng-content></ng-content>
    </button>
  `,
  styleUrls: ['./studio-toolbar-button.component.scss']
})
export class StudioToolbarButtonComponent {
  @Input() active: boolean = false;
  @Input() disabled: boolean = false;
  @Output() onClick = new EventEmitter<MouseEvent>();
}
