import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-gallery-item-overlay',
  templateUrl: './gallery-item-overlay.component.html',
  styleUrls: ['./gallery-item-overlay.component.scss'],
})
export class GalleryItemOverlayComponent {
  @Input() itemType: string = '';
  @Input() mimeType: string | undefined = '';
}
