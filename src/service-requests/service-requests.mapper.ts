import { ServiceRequestDocument } from './schemas/service-request.schema';
import { DriverDocument } from '../drivers/schemas/driver.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { toPublicDriver } from '../drivers/drivers.mapper';

export function toRequestResponse(
  request: ServiceRequestDocument,
  driver: DriverDocument | null,
  customer: UserDocument | null = null,
) {
  return {
    id: request._id.toString(),
    customerId: request.customerId.toString(),
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone ?? null,
    serviceType: request.serviceType,
    pickupLocation: request.pickupLocation,
    pickupAddress: request.pickupAddress,
    estimatedPrice: request.estimatedPrice,
    finalPrice: request.finalPrice,
    estimatedMinutes: request.estimatedMinutes,
    status: request.status,
    driverLocation: request.driverLocation,
    notes: request.notes,
    photoUrls: request.photoUrls,
    rating: request.rating,
    review: request.review,
    assignedDriver: driver ? toPublicDriver(driver) : null,
    paymentMethod: request.paymentMethod,
    cashCollected: request.cashCollected,
    createdAt: (request as unknown as { createdAt: Date }).createdAt,
  };
}
