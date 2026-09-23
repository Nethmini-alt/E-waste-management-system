export interface Buyer {
  buyerId: string;
  userId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  buyerType: 'Local' | 'Export';
  status: 'Pending' | 'Active' | 'Suspended';
  createdAt: string;
  updatedAt?: string;
}

export interface CreateBuyerRequest {
  userId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  buyerType: 'Local' | 'Export';
}

export interface UpdateBuyerRequest {
  companyName: string;
  contactPerson: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  buyerType: 'Local' | 'Export';
  status: 'Pending' | 'Active' | 'Suspended';
}

export interface AvailableUser {
  userId: string;
  fullName: string;
  email: string;
}