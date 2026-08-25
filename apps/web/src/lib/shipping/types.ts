export type ShippingMode = "test" | "live";
export type ShippingProvider = "mng";

export type LabelFormat = "PDF" | "ZPL";
export type WeightUnit = "KG" | "LB";
export type DimensionUnit = "CM" | "IN";
export type PackageType = "BOX" | "DOCUMENT" | "PARCEL";

export type CreateShipmentInput = {
  orderId: string;
  currency: string;
  recipient: {
    fullName: string;
    phone: string;
    email?: string;
  };
  address: {
    countryCode: string;
    city: string;
    district?: string;
    postalCode?: string;
    addressLine: string;
  };
  parcels: Array<{
    weight: number;
    desi?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
  }>;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    sku?: string;
  }>;
  notes?: string;
};

export type CreateOrderResult = {
  provider: ShippingProvider;
  status: string;
  referenceId: string;
  orderInvoiceId?: string;
  orderInvoiceDetailId?: string;
  shipperBranchCode?: string;
  raw?: unknown;
};

export type CreateBarcodeResult = {
  provider: ShippingProvider;
  status: string;
  referenceId: string;
  shipmentId: string;
  trackingNumber: string;
  trackingUrl?: string;
  labelUrl?: string;
  labelZpl?: string;
  invoiceId?: string;
  raw?: unknown;
};

export type CreateShipmentResult = {
  provider: ShippingProvider;
  shipmentId: string;
  trackingNumber: string;
  trackingUrl?: string;
  labelUrl?: string;
  labelZpl?: string;
  status: string;
  raw?: unknown;
};

export type MngShippingConfig = {
  isActive: boolean;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  useIBMHeaders: boolean;
  headerClientIdKey: string;
  headerClientSecretKey: string;
  customerNumber: string;
  password: string;
  identityType: number;
  tokenPath: string;
  createOrderPath: string;
  createBarcodePath: string;
  cancelShipmentPath?: string;
  customerCode?: string;
  senderCustomerId?: string;
  accountNumber?: string;
  labelFormat: LabelFormat;
  defaultPackageType: PackageType;
  defaultCurrency: string;
  defaultWeightUnit: WeightUnit;
  defaultDimensionUnit: DimensionUnit;
  notes?: string;
};

export type ShippingSettingsShape = {
  activeProvider?: ShippingProvider;
  mode?: ShippingMode;
  features?: {
    createShipment?: boolean;
    cancelShipment?: boolean;
    tracking?: boolean;
    labelDownload?: boolean;
  };
  providers?: {
    mng?: Partial<MngShippingConfig> & {
      endpointPath?: string; // legacy fallback
    };
  };
};