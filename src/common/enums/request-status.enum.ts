export enum RequestStatus {
  SEARCHING = 'searching',
  DRIVER_ASSIGNED = 'driverAssigned',
  DRIVER_EN_ROUTE = 'driverEnRoute',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'inProgress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Requests that are still "in flight" — searching for a driver or being worked.
export const ACTIVE_REQUEST_STATUSES = [
  RequestStatus.SEARCHING,
  RequestStatus.DRIVER_ASSIGNED,
  RequestStatus.DRIVER_EN_ROUTE,
  RequestStatus.ARRIVED,
  RequestStatus.IN_PROGRESS,
];

// Legal transitions a driver-initiated status change can make from a given current status.
export const LEGAL_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.SEARCHING]: [],
  [RequestStatus.DRIVER_ASSIGNED]: [RequestStatus.DRIVER_EN_ROUTE, RequestStatus.CANCELLED],
  [RequestStatus.DRIVER_EN_ROUTE]: [RequestStatus.ARRIVED, RequestStatus.CANCELLED],
  [RequestStatus.ARRIVED]: [RequestStatus.IN_PROGRESS, RequestStatus.CANCELLED],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.COMPLETED],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.CANCELLED]: [],
};
