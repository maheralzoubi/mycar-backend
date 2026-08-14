export enum ServiceType {
  FLATBED_TOWING = 'flatbedTowing',
  BATTERY_JUMP = 'batteryJump',
  TIRE_REPAIR = 'tireRepair',
  CAR_TOWING = 'carTowing',
  BATTERY_REPLACEMENT = 'batteryReplacement',
  FUEL_DELIVERY = 'fuelDelivery',
}

export const SERVICE_CATALOG: Record<
  ServiceType,
  { basePrice: number; etaMinutes: number }
> = {
  [ServiceType.FLATBED_TOWING]: { basePrice: 150.0, etaMinutes: 25 },
  [ServiceType.BATTERY_JUMP]: { basePrice: 65.0, etaMinutes: 15 },
  [ServiceType.TIRE_REPAIR]: { basePrice: 55.0, etaMinutes: 20 },
  [ServiceType.CAR_TOWING]: { basePrice: 100.0, etaMinutes: 20 },
  [ServiceType.BATTERY_REPLACEMENT]: { basePrice: 130.0, etaMinutes: 30 },
  [ServiceType.FUEL_DELIVERY]: { basePrice: 45.0, etaMinutes: 18 },
};

export const PRICE_PER_KM = 5.0;

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.FLATBED_TOWING]: 'Flatbed Towing',
  [ServiceType.BATTERY_JUMP]: 'Battery Jump',
  [ServiceType.TIRE_REPAIR]: 'Tire Repair',
  [ServiceType.CAR_TOWING]: 'Car Towing',
  [ServiceType.BATTERY_REPLACEMENT]: 'Battery Replacement',
  [ServiceType.FUEL_DELIVERY]: 'Fuel Delivery',
};
