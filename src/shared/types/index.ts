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
  packageId?: string; // ID do pacote usado (se aplicável)
  unitId: string;
  createdAt: Date;
  updatedAt: Date;
  child?: Child;
  payment?: Payment;
}

export interface Payment {
  id: string;
  customerId: string;
  childId?: string;
  childName?: string;
  amount: number;
  method: string;
  status: string;
  type: 'visit' | 'package'; // Tipo: visita avulsa ou pacote
  packageId?: string; // ID do pacote se for pagamento de pacote
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
  expiresAt?: Date; // Mantido para compatibilidade com pacotes antigos
  expiryDays?: number; // Número de dias até expiração (ex: 30, 60, 90)
  active: boolean;
  sharedAcrossUnits: boolean; // Permite uso em todas as unidades
  paymentId?: string; // ID do pagamento que ativou o pacote
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

export interface FiscalConfig {
  id: string;
  companyName: string;
  cnpj: string;
  ie: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  printerPort: string;
  printerModel: 'MP-4200' | 'MP-2100' | 'MP-7000' | 'other';
  enableFiscalPrint: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FiscalNote {
  id: string;
  visitId: string;
  paymentId?: string;
  customerId: string;
  customerName: string;
  customerCpf?: string;
  items: FiscalItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  fiscalNumber?: string;
  series?: string;
  status: 'pending' | 'printed' | 'cancelled' | 'error';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FiscalItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxCode?: string;
}
