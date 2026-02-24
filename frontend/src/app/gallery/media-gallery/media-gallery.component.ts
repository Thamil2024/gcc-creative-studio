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

import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { MediaItemSelection } from '../../common/components/image-selector/image-selector.component';
import { MODEL_CONFIGS } from '../../common/config/model-config';
import { JobStatus, MediaItem } from '../../common/models/media-item.model';
import { GalleryItem } from '../../common/models/gallery-item.model';
import { GallerySearchDto } from '../../common/models/search.model';
import { UserService } from '../../common/services/user.service';
import { GalleryService } from '../gallery.service';

@Component({
  selector: 'app-media-gallery',
  templateUrl: './media-gallery.component.html',
  styleUrl: './media-gallery.component.scss',
})
export class MediaGalleryComponent implements OnInit, OnDestroy, AfterViewInit {
  @Output() mediaItemSelected = new EventEmitter<MediaItemSelection>();
  @Input() filterByType:
    | 'image/png'
    | 'video/mp4'
    | 'audio/mpeg'
    | 'audio/wav'
    | 'image/*'
    | 'video/*'
    | 'audio/*'
    | null = null;
  @Input() statusFilter: string | null = JobStatus.COMPLETED;

  @Input() showOnlyMyMedia = false;
  @Input() isSelectionMode = false;
  @Output() mediaSelected = new EventEmitter<GalleryItem>();

  images: GalleryItem[] = [];
  filteredImages: GalleryItem[] = [];
  groups: { title: string; columns: GalleryItem[][] }[] = [];

  public allImagesLoaded = false;

  public isLoading = true;
  private imagesSubscription: Subscription | undefined;
  private allImagesLoadedSubscription: Subscription | undefined;
  private loadingSubscription: Subscription | undefined;
  private resizeSubscription: Subscription | undefined;
  private _hostVisibilityObserver!: IntersectionObserver;
  private _scrollObserver!: IntersectionObserver;
  private numColumns = 4;
  public userEmailFilter = '';
  public mediaTypeFilter = '';
  public generationModelFilter = '';
  public generationModels = MODEL_CONFIGS.map(config => ({
    value: config.value,
    viewValue: config.viewValue.replace('\n', ''), // Remove newlines for dropdown
  }));
  private autoSlideIntervals: { [id: string]: any } = {};

  isBrowser: boolean;

  constructor(
    private galleryService: GalleryService,
    private sanitizer: DomSanitizer,
    public matIconRegistry: MatIconRegistry,
    private userService: UserService,
    private elementRef: ElementRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.matIconRegistry
      .addSvgIcon(
        'mobile-white-gemini-spark-icon',
        this.setPath(`${this.path}/mobile-white-gemini-spark-icon.svg`),
      )
      .addSvgIcon(
        'gemini-spark-icon',
        this.setPath(`${this.path}/gemini-spark-icon.svg`),
      );
  }

  private path = '../../assets/images';

  private setPath(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnInit(): void {
    this.mediaTypeFilter = this.filterByType || '';
    this.searchTerm(); // Set initial filters
    this.loadingSubscription = this.galleryService.isLoading$.subscribe(
      loading => {
        this.isLoading = loading;
        if (!loading && this.isBrowser) {
          // Re-check loading finishes
          setTimeout(() => {
            // Logic to handle post-loading if needed
          }, 100);
        }
      },
    );

    this.imagesSubscription = this.galleryService.images$.subscribe(images => {
      if (images) {
        // Find only the new images that have been added
        const newImages = images.slice(this.images.length);
        newImages.forEach(image => {
          // Intervals now handled by child component
        });
        this.images = images as GalleryItem[]; // Cast to GalleryItem[]
        this.filterImages();
      }
    });

    this.allImagesLoadedSubscription =
      this.galleryService.allImagesLoaded.subscribe(loaded => {
        this.allImagesLoaded = loaded;
      });

    if (this.isBrowser) {
        this.handleResize();
        this.resizeSubscription = fromEvent(window, 'resize')
        .pipe(debounceTime(200))
        .subscribe(() => this.handleResize());
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
  }


  ngOnDestroy(): void {
    if (this.isBrowser) {
        // Force pause any lingering audio elements to prevent them from playing after component destruction
        const audios = this.elementRef.nativeElement.querySelectorAll('audio');
        audios.forEach((a: HTMLAudioElement) => {
        a.pause();
        a.src = '';
        });
    }

    this.resizeSubscription?.unsubscribe();
    this._hostVisibilityObserver?.disconnect();
    this._scrollObserver?.disconnect();
  }

  public trackByImage(index: number, image: GalleryItem): number | string {
    return `${image.itemType}_${image.id}`;
  }

  public trackByGroup(index: number, group: { title: string }): string {
    return group.title;
  }

  public loadMore(): void {
    if (!this.isLoading && !this.allImagesLoaded) {
      this.galleryService.loadGallery();
    }
  }

  selectMedia(media: GalleryItem, event: Event): void {
    // Deprecated: Handled by GalleryCardComponent
  }

  public onShowOnlyMyMediaChange(event: MatCheckboxChange): void {
    if (event.checked) {
      const userDetails = this.userService.getUserDetails();
      if (userDetails?.email) this.userEmailFilter = userDetails.email;
    } else this.userEmailFilter = '';
  }

  private handleResize(): void {
    const width = window.innerWidth;
    let newNumColumns;
    if (width < 768) {
      // md breakpoint
      newNumColumns = 2;
    } else if (width < 1024) {
      // lg breakpoint
      newNumColumns = 3;
    } else {
      newNumColumns = 4;
    }

    if (newNumColumns !== this.numColumns) {
      this.numColumns = newNumColumns;
      this.updateGroups();
    }
  }

  private updateGroups(): void {
    // 1. Group images
    const groupsMap = new Map<string, GalleryItem[]>();
    // We want to preserve order of groups based on time
    const groupOrder: string[] = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Helper to get start of week (Sunday)
    const getStartOfWeek = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day;
      return new Date(date.setDate(diff));
    };

    this.images.forEach(image => {
      if (!image.createdAt) return;
      const date = new Date(image.createdAt);
      // Reset time for comparison
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      let groupName = '';

      const diffTime = today.getTime() - dateOnly.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);

      if (dateOnly.getTime() === today.getTime()) {
        groupName = 'Today';
      } else if (dateOnly.getTime() === yesterday.getTime()) {
        groupName = 'Yesterday';
      } else if (diffDays <= 60) {
        // Weekly for last 2 months
        const startOfWeek = getStartOfWeek(dateOnly);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        const startOption: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        const endOption: Intl.DateTimeFormatOptions = { day: 'numeric' };

        // If end of week is in different month, show both months
        if (startOfWeek.getMonth() !== endOfWeek.getMonth()) {
          groupName = `${startOfWeek.toLocaleDateString('en-US', startOption)} - ${endOfWeek.toLocaleDateString('en-US', startOption)}`;
        } else {
          groupName = `${startOfWeek.toLocaleDateString('en-US', startOption)} - ${endOfWeek.toLocaleDateString('en-US', endOption)}`;
        }
      } else {
        // Monthly for older
        const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
        groupName = dateOnly.toLocaleDateString('en-US', options);
      }

      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, []);
        groupOrder.push(groupName);
      }
      groupsMap.get(groupName)?.push(image);
    });

    // 2. Create columns for each group
    this.groups = groupOrder.map(title => {
      const items = groupsMap.get(title) || [];
      const columns = Array.from({ length: this.numColumns }, () => [] as GalleryItem[]);
      items.forEach((item, index) => {
        columns[index % this.numColumns].push(item);
      });
      return { title, columns };
    });
  }

  private filterImages() {
    // Client-side filtering if needed, mostly handled by backend search
    // But we might filter by status locally if statusFilter is 'FAILED' etc and backend returns all?
    // Actually backend handles it.
    // But we need to assign filteredImages for display if we use it?
    // The template uses groups, which uses this.images directly in updateGroups.
    // Let's just update groups.
    this.updateGroups();
  }

  public searchTerm(): void {
    // Reset local component state for a new search to show the main loader
    this.images = [];

    const filters: GallerySearchDto = { limit: 40 };
    if (this.userEmailFilter) {
      filters['userEmail'] = this.userEmailFilter;
    }
    const mimeType = this.filterByType
      ? this.filterByType
      : this.isSelectionMode
        ? null
        : this.mediaTypeFilter;
    if (mimeType) {
      filters['mimeType'] = mimeType;
    }
    if (this.generationModelFilter && !this.isSelectionMode) {
      filters['model'] = this.generationModelFilter;
    }
    if (this.statusFilter) {
      filters['status'] = this.statusFilter;
    }
    this.galleryService.setFilters(filters);
  }
}
