export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
  children?: Child[];
  payments?: Payment[];
  packages?: Package[];
}

export interface Child {
  id: string;
  name: string;
  age: number;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
  visits?: Visit[];
}

export interface Visit {
  id: string;
  childId: string;
  checkIn: Date;
  checkOut?: Date;
  duration?: number;
  value?: number;
  paid: boolean;
  paymentId?: string;
  unitId: string;
  createdAt: Date;
  updatedAt: Date;
  child?: Child;
  payment?: Payment;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  method: string;
  status: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
  visits?: Visit[];
}

export interface Unit {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  active: boolean;
}

export interface Package {
  id: string;
  customerId: string;
  childId: string;
  type: string;
  hours: number;
  usedHours: number;
  price: number;
  expiresAt?: Date;
  active: boolean;
  sharedAcrossUnits: boolean; // Permite uso em todas as unidades
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
}

export interface Settings {
  id: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  activeVisits: number;
  todayRevenue: number;
  todayVisits: number;
  activePackages: number;
}

export interface CheckInData {
  childId: string;
  unitId: string;
}

export interface CheckOutData {
  visitId: string;
  duration?: number;
  value?: number;
  paymentMethod?: string;
}

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao' | 'pacote';
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';
export type PackageType = 'hours' | 'monthly' | 'unlimited';
