import { ChangeDetectionStrategy, Component, DestroyRef, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';
import { ProductApiService } from './product-api.service';
import { Category, CategoryFilter, CategoryFilterFlat, Shop, StockStatus } from './product.type';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AsyncPipe, CurrencyPipe, DecimalPipe, NgStyle } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { SelectionModel } from '@angular/cdk/collections';
import { treeFilter } from '../utils/search';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageEvent } from '@angular/material/paginator';
import { CdkTableModule } from '@angular/cdk/table';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTreeModule } from '@angular/material/tree';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';

@Pipe({
  name: 'statusToSeverity',
  standalone: true
})
export class StatusToSeverityPipe implements PipeTransform {
  transform(item: StockStatus): string | undefined {
    switch (item) {
      case 'INSTOCK': return 'has-background-success';
      case 'LOWSTOCK': return 'has-background-warning';
      case 'OUTOFSTOCK': return 'has-background-danger';
    }
  }
}

@Component({
  selector: 'admin-products-list',
  templateUrl: 'products-list.component.html',
  standalone: true,
  imports: [
    StatusToSeverityPipe,
    AsyncPipe,
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NgStyle,
    CdkTableModule,
    CdkTreeModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatTableModule,
    MatTreeModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatPaginatorModule,
    MatInputModule,
    MatChipsModule
  ],
  providers: [ProductApiService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsListComponent {
  #destroyRef = inject(DestroyRef)
  #fb = inject(FormBuilder)
  #productApi = inject(ProductApiService)
  #isExpanded = false
  #paggination: PageEvent
  #categories: CategoryFilter[]

  total = signal(0)
  sellableArr = signal(['SELLABLE', 'NOT SELLABLE'])
  searchForm = this.#fb.group({
    name: this.#fb.control(''),
    sellable: this.#fb.control<'SELLABLE' | 'NOT SELLABLE'>(null),
    shop: this.#fb.control<Shop[]>([]),
    category: this.#fb.control<Category[]>([]),
    status: this.#fb.control<{ label: string, value: StockStatus }>(null)
  })
  statuses = signal<{ label: string, value: StockStatus }[]>([
    { label: 'IN STOCK', value: 'INSTOCK' },
    { label: 'LOW', value: 'LOWSTOCK' },
    { label: 'OUT', value: 'OUTOFSTOCK' }
  ]);
  displayedColumns = signal(['name', 'category', 'sellable', 'shop', 'price', 'stock', 'status', 'edit']);
  displayedSearchColumns = computed(() => this.displayedColumns().map(col => `${col}-search`))

  shops$ = this.#productApi.fetchShops()

  constructor() {
    this.#loadProducts()
    this.#loadCategories()
    this.searchForm.valueChanges.pipe(
      takeUntilDestroyed(this.#destroyRef),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(_ => this.#loadProducts())
  }

  // displayCategoryFn(category: Category): string {
  //   return category?.path || '';
  // }

  private transformer = (node: any, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      category: node.category,
      sellable: node.sellable,
      price: node.price,
      stock: node.stock,
      shop: node.shop,
      inventoryStatus: node.inventoryStatus,
      unitOfMeasure: node.unitOfMeasure,
      level: level
    };
  }

  treeControl = new FlatTreeControl<any>(
      node => node.level, node => node.expandable);

  treeFlattener = new MatTreeFlattener(
      this.transformer, node => node.level, 
      node => node.expandable, node => node.children);

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  // START CATEGORIES DROPDOWN
  hasChild = (_: number, _nodeData: CategoryFilterFlat) => _nodeData.expandable;
  /**
   * Transformer to convert nested node to flat node. Record the nodes in maps for later use.
   */
  #categoryTransformer = (node: CategoryFilter, level: number) => {
    const existingNode = this.#categoryNestedNodeMap.get(node);
    const flatNode =
      existingNode && existingNode.key === node.key
        ? existingNode
        : {} as CategoryFilterFlat;
    flatNode.key = node.key;
    flatNode.label = node.label;
    flatNode.level = level;
    flatNode.expandable = !!node.children;
    this.#categoryNestedNodeMap.set(node, flatNode);
    return flatNode;
  };
  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  #categoryNestedNodeMap = new Map<CategoryFilter, CategoryFilterFlat>();
  #categoryFreeFlattener: MatTreeFlattener<CategoryFilter, CategoryFilterFlat> = new MatTreeFlattener(
    this.#categoryTransformer, node => node.level, 
    node => node.expandable, node => node.children);
  categoryTreeControl: FlatTreeControl<CategoryFilterFlat> = new FlatTreeControl<CategoryFilterFlat>(
    node => node.level,
    node => node.expandable
  );
  categoryDataSource: MatTreeFlatDataSource<CategoryFilter, CategoryFilterFlat> = new MatTreeFlatDataSource(
    this.categoryTreeControl,
    this.#categoryFreeFlattener
  );
  /** The selection for checklist */
  categoryChecklistSelection = new SelectionModel<CategoryFilterFlat>(true /* multiple */);

  /** Whether all the descendants of the node are selected. */
  descendantsAllSelected(node: CategoryFilterFlat): boolean {
    const descendants = this.categoryTreeControl.getDescendants(node);
    const descAllSelected = descendants.every(child =>
      this.categoryChecklistSelection.isSelected(child)
    );
    return descAllSelected;
  }

  /** Whether part of the descendants are selected */
  descendantsPartiallySelected(node: CategoryFilterFlat): boolean {
    const descendants = this.categoryTreeControl.getDescendants(node);
    const result = descendants.some(child =>
      this.categoryChecklistSelection.isSelected(child)
    );
    return result && !this.descendantsAllSelected(node);
  }

  /** Toggle the to-do item selection. Select/deselect all the descendants node */
  todoItemSelectionToggle(node: CategoryFilterFlat): void {
    this.categoryChecklistSelection.toggle(node);
    const descendants = this.categoryTreeControl.getDescendants(node);
    this.categoryChecklistSelection.isSelected(node)
      ? this.categoryChecklistSelection.select(...descendants)
      : this.categoryChecklistSelection.deselect(...descendants);

    // Force update for the parent
    descendants.every(child => this.categoryChecklistSelection.isSelected(child));
    this.#checkAllParentsSelection(node);
    this.#loadProducts()
  }

  /** Toggle a leaf to-do item selection. Check all the parents to see if they changed */
  todoLeafItemSelectionToggle(node: CategoryFilterFlat): void {
    this.categoryChecklistSelection.toggle(node);
    this.#checkAllParentsSelection(node);
    this.#loadProducts()
  }

  /* Checks all the parents when a leaf node is selected/unselected */
  #checkAllParentsSelection(node: CategoryFilterFlat): void {
    let parent: CategoryFilterFlat | null = this.#getParentNode(node);
    while (parent) {
      this.#checkRootNodeSelection(parent);
      parent = this.#getParentNode(parent);
    }
  }

  /** Check root node checked state and change it accordingly */
  #checkRootNodeSelection(node: CategoryFilterFlat): void {
    const nodeSelected = this.categoryChecklistSelection.isSelected(node);
    const descendants = this.categoryTreeControl.getDescendants(node);
    const descAllSelected = descendants.every(child =>
      this.categoryChecklistSelection.isSelected(child)
    );
    if (nodeSelected && !descAllSelected) {
      this.categoryChecklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.categoryChecklistSelection.select(node);
    }
  }

  /* Get the parent node of a node */
  #getParentNode(node: CategoryFilterFlat): CategoryFilterFlat | null {
    console.log(this.categoryChecklistSelection.selected);
    const currentLevel = node.level;

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.categoryTreeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.categoryTreeControl.dataNodes[i];

      if (currentNode.level < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  getSelectedItems(): string {
    if (!this.categoryChecklistSelection.selected.length) return "";
    return this.categoryChecklistSelection.selected.map(s => s.label).join(",");
  }

  filterChanged(filterText: string) {
    // treeFilter method which actually filters the tree and gives back a tree structure
    this.categoryDataSource.data = treeFilter(filterText, this.#categories)
    if (filterText) {
      this.categoryTreeControl.expandAll();
    } else {
      this.categoryTreeControl.collapseAll();
    }
  }
  // END CATEGORIES DROPDOWN

  onPageChange(paggination: PageEvent) {
    this.#paggination = paggination
    this.#loadProducts()
  }


  expandAll() {
    this.treeControl.expandAll()
    this.#isExpanded = true
  }

  collapseAll() {
    this.treeControl.collapseAll()
    this.#isExpanded = false
  }

  #loadProducts() {
    const categoryIds = this.categoryChecklistSelection.selected.map(item => item.key)
    const { name, sellable, shop, status } = this.searchForm.value
    this.#productApi.fetchProducts({ shops: shop, categoryIds, status, sellable, name, paggination: this.#paggination }).subscribe(({ items, total }) => {
      this.dataSource.data = items
      this.total.set(total)
      if (this.#isExpanded) this.expandAll()
    })
  }

  #loadCategories() {
    this.#productApi.fetchCategories().subscribe(items => {
      this.categoryDataSource.data = items
      this.#categories = items
    })
  }
}