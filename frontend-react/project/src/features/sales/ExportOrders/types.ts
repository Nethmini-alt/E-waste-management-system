export interface ExportOrderItem {
  exportOrderItemId: string;
  recoveredMaterialId: string;
  materialType: string;
  quantityKg: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ExportOrder {
  exportOrderId: string;
  buyerId: string;
  buyerCompanyName: string;
  orderDate: string;
  destinationCountry: string;
  shipmentDate: string;
  totalWeightKg: number;
  totalValue: number;
  status: 'Draft' | 'PendingApproval' | 'Approved' | 'Shipped' | 'Completed' | 'Cancelled';
  notes?: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt?: string | null;
  items: ExportOrderItem[];
}

export interface CreateExportOrderItemRequest {
  recoveredMaterialId: string;
  quantityKg: number;
}

export interface CreateExportOrderRequest {
  buyerId: string;
  destinationCountry: string;
  shipmentDate: string;
  notes?: string;
  items: CreateExportOrderItemRequest[];
}

export interface UpdateExportOrderStatusRequest {
  status: ExportOrder['status'];
}