import { Component } from '@angular/core';

@Component({
  selector: 'studio-toolbar',
  template: '<div class="glass-toolbar"><ng-content></ng-content></div>',
  styleUrls: ['./studio-toolbar.component.scss']
})
export class StudioToolbarComponent {}
