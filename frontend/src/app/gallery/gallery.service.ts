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

import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  of,
  Subscription,
} from 'rxjs';
import {
  catchError,
  debounceTime,
  shareReplay,
  switchMap,
  map
} from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  MediaItem,
  JobStatus,
} from '../common/models/media-item.model';
import {
  GalleryItem,
  PaginatedGalleryResponse
} from '../common/models/gallery-item.model';
import { GallerySearchDto } from '../common/models/search.model';
import { WorkspaceStateService } from '../services/workspace/workspace-state.service';

@Injectable({
  providedIn: 'root',
})
export class GalleryService implements OnDestroy {
  private imagesCache$ = new BehaviorSubject<GalleryItem[]>([]);
  public isLoading$ = new BehaviorSubject<boolean>(false);
  private allImagesLoaded$ = new BehaviorSubject<boolean>(false);
  private currentPage = 0;
  private pageSize = 40;
  private allFetchedImages: GalleryItem[] = [];
  private filters$ = new BehaviorSubject<GallerySearchDto>({ limit: 40 });
  private dataLoadingSubscription: Subscription;

  constructor(
    private http: HttpClient,
    private workspaceStateService: WorkspaceStateService,
  ) {
    this.dataLoadingSubscription = combineLatest([
      this.workspaceStateService.activeWorkspaceId$,
      this.filters$,
    ])
      .pipe(
        // Use debounceTime to wait for filters to be set and prevent rapid reloads
        debounceTime(50),
        switchMap(([workspaceId, filters]) => {
          this.isLoading$.next(true);
          this.resetCache();

          const body: GallerySearchDto = {
            ...filters,
            workspaceId: workspaceId ?? undefined,
          };

          return this.fetchImages(body).pipe(
            catchError(err => {
              console.error('Failed to fetch gallery images', err);
              this.isLoading$.next(false);
              this.allImagesLoaded$.next(true); // prevent loading more
              return of(null); // Return null or an empty response to prevent breaking the stream
            }),
          );
        }),
      )
      .subscribe(response => {
        if (response) {
          this.processFetchResponse(response);
        }
      });
  }

  get images$(): Observable<GalleryItem[]> {
    return this.imagesCache$.asObservable();
  }

  get allImagesLoaded(): Observable<boolean> {
    return this.allImagesLoaded$.asObservable();
  }

  ngOnDestroy() {
    this.dataLoadingSubscription.unsubscribe();
  }

  setFilters(filters: GallerySearchDto) {
    this.filters$.next(filters);
    // No need to call loadGallery here, the stream will automatically react.
  }

  loadGallery(reset = false): void {
    if (this.isLoading$.value) {
      return;
    }

    if (reset) {
      this.resetCache();
    }

    if (this.allImagesLoaded$.value) {
      return;
    }

    const body: GallerySearchDto = {
      ...this.filters$.value,
      workspaceId:
        this.workspaceStateService.getActiveWorkspaceId() ?? undefined,
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
    };

    this.fetchImages(body)
      .pipe(
        catchError(err => {
          console.error('Failed to fetch gallery images', err);
          this.isLoading$.next(false);
          this.allImagesLoaded$.next(true); // prevent loading more
          return of(null);
        }),
      )
      .subscribe(response => {
        if (response) {
          this.processFetchResponse(response, /* append= */ true);
        }
      });
  }

  private fetchImages(
    body: GallerySearchDto,
  ): Observable<PaginatedGalleryResponse> {
    this.isLoading$.next(true);
    const galleryUrl = `${environment.backendURL}/gallery/search`;
    return this.http
      .post<PaginatedGalleryResponse>(galleryUrl, body)
      .pipe(shareReplay(1));
  }

  private resetCache() {
    this.allFetchedImages = [];
    this.currentPage = 0;
    this.allImagesLoaded$.next(false);
    this.imagesCache$.next([]);
  }

  private processFetchResponse(
    response: PaginatedGalleryResponse,
    append = false,
  ) {
    this.currentPage++;
    this.allFetchedImages = append
      ? [...this.allFetchedImages, ...this.mapUnifiedResponse(response.data)]
      : this.mapUnifiedResponse(response.data);
    this.imagesCache$.next(this.allFetchedImages);

    if (this.currentPage >= response.totalPages) {
      this.allImagesLoaded$.next(true);
    }
    this.isLoading$.next(false);
  }

  getMedia(id: number): Observable<GalleryItem> {
    const cached = this.allFetchedImages.find(i => i.id === id && i.itemType === 'media_item');
    if (cached) {
      return of(cached);
    }

  // For now, always fetch details to ensure we have full MediaItem data
  // Or map from GalleryItem if enough data is present
    const detailUrl = `${environment.backendURL}/gallery/item/${id}`;
    return this.http.get<any>(detailUrl).pipe(
      map(response => this.mapUnifiedItem(response))
    );
  }

  getAsset(id: number): Observable<GalleryItem> {
    const cached = this.allFetchedImages.find(
      i => i.id === id && i.itemType === 'source_asset'
    );
    if (cached) {
      return of(cached);
    }

    // Always fetch for now to get full details and ensure type safety
    const assetUrl = `${environment.backendURL}/source_assets/${id}`;
    return this.http.get<any>(assetUrl).pipe(
      map(asset => {
        // Map SourceAssetResponseDto to GalleryItem
        const metadata = {
          assetType: asset.assetType || asset.asset_type,
          original_filename: asset.filename || asset.original_filename,
          mime_type: asset.mimeType || asset.mime_type,
        };
        const item: GalleryItem = {
          id: asset.id,
          workspaceId: asset.workspaceId || asset.workspace_id || 0, // Fallback if not provided, though it should be
          createdAt: asset.created_at || asset.createdAt,
          status: asset.status,
          itemType: 'source_asset',
          mimeType: asset.mimeType || asset.mime_type,
          prompt: asset.filename || asset.original_filename || 'Asset',
          gcsUris: [asset.gcsUri || asset.gcs_uri],
          thumbnailUris: [asset.thumbnailGcsUri || asset.thumbnail_gcs_uri || ''],
          presignedUrls: [asset.presignedUrl || asset.presigned_url],
          presignedThumbnailUrls: [asset.presignedThumbnailUrl || asset.presigned_thumbnail_url],
          metadata: metadata,
        };
        // Normalize arrays if backend only provides single string
        if (!item.gcsUris?.[0]) item.gcsUris = [];
        if (!item.thumbnailUris?.[0]) item.thumbnailUris = [];
        if (!item.presignedUrls?.[0]) item.presignedUrls = [];
        if (!item.presignedThumbnailUrls?.[0]) item.presignedThumbnailUrls = [];

        return item;
      })
    );
  }

  private mapUnifiedResponse(data: any[]): GalleryItem[] {
    return data.map(item => this.mapUnifiedItem(item));
  }

  private mapUnifiedItem(item: any): GalleryItem {
    const metadata = item.metadata || {};
    const galleryItem: GalleryItem = {
      id: item.id,
      workspaceId: item.workspaceId,
      userId: item.userId,
      createdAt: item.createdAt,
      itemType: item.itemType,
      status: item.status,
      gcsUris: item.gcsUris || [],
      thumbnailUris: item.thumbnailUris || [],
      presignedUrls: item.presignedUrls || [],
      presignedThumbnailUrls: item.presignedThumbnailUrls || [],
      metadata: metadata,

      // Mapped display fields
      mimeType: metadata.mime_type || metadata.mimeType,
      aspectRatio: metadata.aspect_ratio || metadata.aspectRatio,
      prompt: metadata.prompt || metadata.original_filename || 'Asset',

      // Detailed fields
      model: item.model,
      userEmail: item.userEmail,
      generationTime: item.generationTime,
      voiceName: item.voiceName,
      languageCode: item.languageCode,
      seed: item.seed,
      numMedia: item.numMedia,
      duration: item.duration,
      resolution: item.resolution,
      googleSearch: item.googleSearch,
      groundingMetadata: item.groundingMetadata,
      rewrittenPrompt: item.rewrittenPrompt,
      negativePrompt: item.negativePrompt,
      enrichedSourceAssets: item.enrichedSourceAssets,
      enrichedSourceMediaItems: item.enrichedSourceMediaItems,
      style: item.style,
      lighting: item.lighting,
      colorAndTone: item.colorAndTone,
      composition: item.composition,
      modifiers: item.modifiers,
      comment: item.comment,
      critique: item.critique,
      rawData: item.rawData,
      audioAnalysis: item.audioAnalysis,
      error_message: item.error_message,
      addWatermark: item.addWatermark,
      sourceImagesGcs: item.sourceImagesGcs,
    };

    return galleryItem;
  }

  // legacy method for MediaItem details if needed, but getAsset/getMedia should ideally return specific types or a union
  private mapSingleItem(item: any): MediaItem {
    // ... existing logic for MediaItem details ...
    return item as MediaItem; // simplified for now, assuming existing usage handles it
  }

  /**
   * Creates a new template based on a media item.
   * @param mediaItemId The ID of the media item to base the template on.
   */
  createTemplateFromMediaItem(mediaItemId: number): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      `${environment.backendURL}/media-templates/from-media-item/${mediaItemId}`,
      {},
    );
  }
}
