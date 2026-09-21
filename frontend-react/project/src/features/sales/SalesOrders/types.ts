export interface SalesOrderItem {
  salesOrderItemId: string;
  recoveredMaterialId: string;
  materialType: string;
  quantityKg: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SalesOrder {
  salesOrderId: string;
  buyerId: string;
  buyerCompanyName: string;
  orderDate: string;
  totalAmount: number;
  status: 'Draft' | 'Confirmed' | 'Completed' | 'Cancelled';
  notes?: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt?: string | null;
  items: SalesOrderItem[];
}

export interface CreateSalesOrderItemRequest {
  recoveredMaterialId: string;
  quantityKg: number;
}

export interface CreateSalesOrderRequest {
  buyerId: string;
  notes?: string;
  items: CreateSalesOrderItemRequest[];
}

export interface UpdateSalesOrderStatusRequest {
  status: SalesOrder['status'];
}