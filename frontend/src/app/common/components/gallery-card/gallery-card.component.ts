/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { GalleryItem } from '../../models/gallery-item.model';
import { MediaItemSelection } from '../image-selector/image-selector.component';
import { MediaItem } from '../../models/media-item.model';

@Component({
  selector: 'app-gallery-card',
  templateUrl: './gallery-card.component.html',
  styleUrls: ['./gallery-card.component.scss'],
})
export class GalleryCardComponent implements OnDestroy {
  @Input() item!: GalleryItem;
  @Input() isSelectionMode: boolean = false;
  
  @Output() mediaItemSelected = new EventEmitter<MediaItemSelection>();
  @Output() mediaSelected = new EventEmitter<GalleryItem>();

  currentImageIndex: number = 0;
  loadedMedia: Record<number, boolean> = {};
  hoveredVideoId: number | null = null;
  hoveredAudioId: number | null = null;

  ngOnDestroy() {
  }

  onMouseEnter() {
    if (this.item.mimeType?.startsWith('video/')) {
      this.hoveredVideoId = this.item.id;
    }
    if (this.item.mimeType?.startsWith('audio/')) {
      this.hoveredAudioId = this.item.id;
    }
  }

  onMouseLeave() {
    this.hoveredVideoId = null;
    this.hoveredAudioId = null;
  }

  nextImageItem(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    const total = this.item.presignedUrls.length;
    this.currentImageIndex = (this.currentImageIndex + 1) % total;
  }

  prevImageItem(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    const total = this.item.presignedUrls.length;
    this.currentImageIndex = (this.currentImageIndex - 1 + total) % total;
  }

  onMediaLoad(index: number = 0): void {
    this.loadedMedia[index] = true;
  }

  isMediaLoaded(index: number = 0): boolean {
    return !!this.loadedMedia[index];
  }

  selectMedia(event: Event): void {
    if (this.isSelectionMode) {
      this.mediaItemSelected.emit({
        mediaItem: this.item as unknown as MediaItem,
        selectedIndex: this.currentImageIndex
      });
    } else {
      this.mediaSelected.emit(this.item);
    }
  }

  getShortPrompt(prompt: string | undefined | null, wordLimit = 20): string {
    if (!prompt) return 'Generated media';
    let textToTruncate = prompt;
    try {
      const parsedPrompt = JSON.parse(prompt);
      if (parsedPrompt && typeof parsedPrompt === 'object' && parsedPrompt.prompt_name) {
        textToTruncate = parsedPrompt.prompt_name;
      }
    } catch (e) {}
    const words = textToTruncate.split(/\s+/);
    if (words.length > wordLimit) return words.slice(0, wordLimit).join(' ') + '...';
    return textToTruncate;
  }
}
