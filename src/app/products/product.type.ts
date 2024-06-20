export type Shop = {
  id: number,
  name: string
}

export type StockStatus = 'INSTOCK' | 'OUTOFSTOCK' | 'LOWSTOCK'

export type CategoryFilter = {
  key: string,
  label: string,
  data?: any,
  children?: CategoryFilter[]
}

export type CategoryFilterFlat = {
  key: string;
  label: string;
  level: number;
  expandable: boolean;
}

export type Category = {
  id: string,
  path: string,
  parent?: string
}

export type Product = {
  id: string,
  name: string,
  sellable: boolean | null,
  category: {
    id: string,
    name: string
  },
  unitOfMeasure: {
    id: string,
    name: string
  },
  stock: number,
  price: number,
  inventoryStatus: StockStatus,
  children: {
    shop: Shop,
    price: number,
    stock: number,
    inventoryStatus: StockStatus
  }[]
}

export type ShopProduct = {
  id: string,
  name: string,
  sellable: boolean | null,
  category: {
    id: string,
    name: string
  },
  unitOfMeasure: {
    id: string,
    name: string
  },
  shop: Shop,
  price: number,
  stock: number,
  inventoryStatus: StockStatus
}