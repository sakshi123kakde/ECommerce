import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from 'src/app/Services/product.service';
import { Product } from '../interface/product.model';
import { CartService } from 'src/app/Services/cart.service';
import { LoginService } from 'src/app/Services/login.service';
import { DatabaseCartService } from 'src/app/Services/database-cart.service';
import { finalize } from 'rxjs';
import { WishlistService } from 'src/app/Services/wishlist.service';

@Component({
  selector: 'app-main-category-products',
  templateUrl: './main-category-products.component.html',
  styleUrls: ['./main-category-products.component.css']
})
export class MainCategoryProductsComponent implements OnInit {
  category = '';
  products: any[] = [];
  filteredProducts: any[] = []; // Array to hold filtered products
  validCategories = ['men', 'women', 'kids']; // Define valid categories
  isLoading = true;
  dbCartProductIds: number[] = [];
  
  // Price filter properties
  minPrice: number = 0;
  maxPrice: number = 5000; // Default max price, matching the reference
  currentMinPrice: number = 0;
  currentMaxPrice: number = 5000;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private router: Router,
    private cartService : CartService,
    private loginService : LoginService,
    private dbCartService : DatabaseCartService,
    private wishlistService: WishlistService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.category = params['category'];
      
      // Check if the category is valid
      if (!this.validCategories.includes(this.category.toLowerCase())) {
        this.router.navigate(['/not-found']);
        return;
      }
      
      this.loadCategoryProducts();
      this.loadCartItems();
    });
  }

  loadCartItems(): void {
    if (this.loginService.isLoggedIn()) {
      const token = this.loginService.getToken();
      if (token) {
        this.isLoading = true;
        this.dbCartService.getCartItems(token)
          .pipe(finalize(() => this.isLoading = false))
          .subscribe({
            next: (items: any[]) => {
              // Extract product IDs from cart items
              this.dbCartProductIds = items.map(item => item.product?.id || item.product_id);
              console.log('Cart items loaded:', this.dbCartProductIds);
            },
            error: (err) => {
              console.error('Error loading cart items:', err);
            }
          });
      }
    } else {
      // For non-logged in users, use the local cart service
      this.dbCartProductIds = this.cartService.getCartItems().map(item => item.id!);
    }
  }

  loadCategoryProducts() {
    this.productService.getAllProducts().subscribe((data: any[]) => {
      this.products = data.filter(product =>
        product.category.toLowerCase() === this.category.toLowerCase()
      );
      
      // Initialize filtered products
      this.filteredProducts = [...this.products];
      
      // Set initial price range based on actual product prices
      if (this.products.length > 0) {
        // Find min and max prices in the product list
        this.minPrice = Math.min(...this.products.map(p => p.discount_price));
        this.maxPrice = Math.max(...this.products.map(p => p.discount_price));
        
        // Set current filter values to match the range
        this.currentMinPrice = this.minPrice;
        this.currentMaxPrice = this.maxPrice;
      }
    });
  }

  // Update price range - immediate filter application
  updatePriceRange(min: string, max: string): void {
    this.currentMinPrice = Number(min);
    this.currentMaxPrice = Number(max);
    this.applyPriceFilter();
  }
  
  // Apply price filter
  applyPriceFilter(): void {
    this.filteredProducts = this.products.filter(product => 
      product.discount_price >= this.currentMinPrice && 
      product.discount_price <= this.currentMaxPrice
    );
  }

  // Reset price filter (called as part of clearFilters)
  resetPriceFilter(): void {
    this.currentMinPrice = this.minPrice;
    this.currentMaxPrice = this.maxPrice;
    this.filteredProducts = [...this.products];
  }
  
  // Clear all filters
  clearFilters(): void {
    this.resetPriceFilter();
  }

  toggleWishlist(product: Product) {
    this.wishlistService.toggleWishlistItem(product);
  }

  goToDetails(id: number) {
    this.router.navigate(['/product-details', id]);
  }

  addToCart(product: Product) {
    const quantity = 1;
  
    if (this.loginService.isLoggedIn()) {
      const token = this.loginService.getToken();
      if (token) {
        this.dbCartService.addToCart(product.id!, quantity, token).subscribe({
          next: (response) => {
            console.log('Item added to DB cart', response);
            this.dbCartProductIds.push(product.id!); // Add to local list immediately
          },
          error: (err) => console.error('Error adding to DB cart', err)
        });
      }
    } else {
      this.cartService.addToCart({ ...product, quantity });
      // Update local tracking for non-logged in users
      this.dbCartProductIds.push(product.id!);
    }
  }
  
  isInCart(productId: number): boolean {
    return this.dbCartProductIds.includes(productId);
  }

  isInWishlist(productId: number): boolean {
    return this.wishlistService.isProductInWishlist(productId);
  }
  
  goToCart() {
    this.router.navigate(['/cart']);
  }

  showMoreNewArrivals(): void {
    this.router.navigate(['/category'], { 
      queryParams: { filter: 'new-arrivals' } 
    });
  }
}