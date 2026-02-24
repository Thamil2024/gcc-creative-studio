import { Component, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MediaItem } from '../../common/models/media-item.model';
import { AuthService } from '../../common/services/auth.service';
import { LoadingService } from '../../common/services/loading.service';
import { GalleryService } from '../gallery.service';
import { GalleryItem } from '../../common/models/gallery-item.model';

@Component({
  selector: 'app-asset-detail',
  templateUrl: './asset-detail.component.html',
  styleUrls: ['./asset-detail.component.scss'],
})
export class AssetDetailComponent implements OnDestroy {
  private routeSub?: Subscription;
  private mediaSub?: Subscription;

  public isLoading = true;
  public assetItem: GalleryItem | undefined;
  public isAdmin = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private galleryService: GalleryService,
    private loadingService: LoadingService,
    private _snackBar: MatSnackBar,
    private authService: AuthService,
  ) {
    this.isAdmin = this.authService.isUserAdmin() ?? false;

    // Get the asset item from the router state if available
    this.assetItem =
      this.router.getCurrentNavigation()?.extras.state?.['mediaItem'];

    if (this.assetItem) {
      this.loadingService.hide();
      this.isLoading = false;
    } else {
      this.fetchAssetItem();
    }
  }

  fetchAssetItem() {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fetchAssetDetails(Number(id));
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.mediaSub?.unsubscribe();
  }

  fetchAssetDetails(id: number): void {
    // We explicitly call getAsset for source assets
    this.mediaSub = this.galleryService.getAsset(id).subscribe({
      next: (data: GalleryItem) => {
        this.assetItem = data;
        this.isLoading = false;
        this.loadingService.hide();
      },
      error: (err: any) => {
        console.error('Failed to fetch asset details', err);
        this.isLoading = false;
        this.loadingService.hide();
      },
    });
  }

  public getGcsLink(uri: string): string {
    if (!uri || !uri.startsWith('gs://')) {
      return '#';
    }
    return `https://console.cloud.google.com/storage/browser/${uri.substring(5)}`;
  }
}
