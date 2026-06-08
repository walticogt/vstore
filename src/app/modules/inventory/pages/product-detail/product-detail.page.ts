import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Product, ProductVariant } from '../../../../core/models/product.model';
import { TagCode } from '../../../../core/models/tag-code.model';
import { ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';

/**
 * ProductDetailPage — detalle del producto con variantes/stock y ajuste de stock
 * (capability: inventory-consultation + product-management).
 */
@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  standalone: false,
})
export class ProductDetailPage {
  product: Product | null = null;
  activeTag: TagCode | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly productService: ProductService,
    private readonly tags: TagService,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  get stockTotal(): number {
    return this.product?.variants.reduce((sum, v) => sum + v.stock, 0) ?? 0;
  }

  async adjustStock(variant: ProductVariant, delta: number): Promise<void> {
    await this.productService.updateVariantStock(variant.id, delta);
    await this.reload();
  }

  private async reload(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.product = await this.productService.getProductById(id);
      this.activeTag = await this.tags.getActiveTagByProduct(id);
    }
  }
}
