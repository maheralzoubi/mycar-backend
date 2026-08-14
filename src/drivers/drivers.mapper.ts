import { DriverDocument } from './schemas/driver.schema';

export function avatarInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function toPublicDriver(driver: DriverDocument, distanceKm?: number) {
  return {
    id: driver._id.toString(),
    name: driver.name,
    phone: driver.phone,
    rating: driver.rating,
    totalJobs: driver.totalJobs,
    vehicleType: driver.vehicleType,
    vehiclePlate: driver.vehiclePlate,
    avatarInitials: avatarInitials(driver.name),
    ...(distanceKm !== undefined ? { distanceKm } : {}),
  };
}

export function toDriverProfile(driver: DriverDocument) {
  return {
    id: driver._id.toString(),
    email: driver.email,
    name: driver.name,
    phone: driver.phone,
    vehicleType: driver.vehicleType,
    vehiclePlate: driver.vehiclePlate,
    rating: driver.rating,
    totalJobs: driver.totalJobs,
    isOnline: driver.isOnline,
    licenseNumber: driver.licenseNumber,
    licensePhotoUrl: driver.licensePhotoUrl,
    vehicleRegistrationPhotoUrl: driver.vehicleRegistrationPhotoUrl,
    verificationStatus: driver.verificationStatus,
    rejectionReason: driver.rejectionReason,
  };
}

export function toAdminDriverView(driver: DriverDocument) {
  return {
    id: driver._id.toString(),
    email: driver.email,
    name: driver.name,
    phone: driver.phone,
    vehicleType: driver.vehicleType,
    vehiclePlate: driver.vehiclePlate,
    rating: driver.rating,
    totalJobs: driver.totalJobs,
    isOnline: driver.isOnline,
    isSuspended: driver.isSuspended,
    currentLocation: driver.currentLocation,
    licenseNumber: driver.licenseNumber,
    licensePhotoUrl: driver.licensePhotoUrl,
    vehicleRegistrationPhotoUrl: driver.vehicleRegistrationPhotoUrl,
    verificationStatus: driver.verificationStatus,
    rejectionReason: driver.rejectionReason,
    createdAt: (driver as unknown as { createdAt: Date }).createdAt,
  };
}
