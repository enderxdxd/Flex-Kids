export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  address?: string;
  unitId?: string;
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
  birthDate?: Date;
  enrollmentCode?: string;
  customerId: string;
  unitId?: string;
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
  kidsPlanId?: string; // ID do plano Kids usado (se aplicável)
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
  unitId?: string; // Unidade onde o pagamento foi realizado
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
  childId?: string; // Opcional - pacote pertence ao responsável, não à criança
  type: string;
  hours: number;
  usedHours: number;
  price: number;
  expiresAt?: Date; // Mantido para compatibilidade com pacotes antigos
  expiryDays?: number; // Número de dias até expiração (ex: 30, 60, 90)
  active: boolean;
  sharedAcrossUnits: boolean; // Permite uso em todas as unidades
  unitId: string; // Unidade onde o pacote foi criado
  paymentId?: string; // ID do pagamento que ativou o pacote
  employeeDiscount?: boolean; // Vendido com desconto de colaborador (50%)
  originalPrice?: number; // Preço original antes do desconto
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
  kidsPlanId?: string;
}

export interface CheckOutData {
  visitId: string;
  duration?: number;
  value?: number;
  paymentMethod?: string;
  packageId?: string;
}

export interface KidsPlan {
  id: string;
  childId: string;
  childName?: string;
  customerId: string;
  enrollmentCode?: string;
  planType: 'KIDS_2X' | 'KIDS_FULL';
  contractNumber: string;
  modality?: string;
  monthlyValue: number;
  totalValue: number;
  durationMonths: number;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expiring' | 'expired' | 'cancelled';
  coach?: string;
  email?: string;
  unitId: string;
  createdAt: Date;
  updatedAt: Date;
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
