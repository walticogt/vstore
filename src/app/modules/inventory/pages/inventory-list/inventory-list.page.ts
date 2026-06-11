import { Component } from '@angular/core';

import { Product } from '../../../../core/models/product.model';
import { ProductService } from '../../../../core/services/product.service';

/**
 * InventoryListPage — listado de productos con stock total, búsqueda y filtro por proveedor
 * (capability: inventory-consultation).
 */
@Component({
  selector: 'app-inventory-list',
  templateUrl: './inventory-list.page.html',
  styleUrls: ['./inventory-list.page.scss'],
  standalone: false,
})
export class InventoryListPage {
  products: Product[] = [];
  suppliers: string[] = [];
  searchTerm = '';
  supplierFilter = '';

  constructor(private readonly productService: ProductService) {}

  async ionViewWillEnter(): Promise<void> {
    this.suppliers = await this.productService.getSuppliers();
    await this.applyFilters();
  }

  async onSearchChange(): Promise<void> {
    await this.applyFilters();
  }

  stockTotal(product: Product): number {
    return product.variants.filter((v) => v.status === 'ACTIVE').length;
  }

  private async applyFilters(): Promise<void> {
    const base = this.searchTerm.trim()
      ? await this.productService.searchProducts(this.searchTerm)
      : await this.productService.getAllProducts();

    this.products = this.supplierFilter
      ? base.filter((p) => p.supplier === this.supplierFilter)
      : base;
  }
}
