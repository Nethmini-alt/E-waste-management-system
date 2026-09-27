// Mirrors the DTOs in backend/EWasteManagement.API/Features/Collection/DTOs.

export type JobStatus =
  | 'Assigned'
  | 'Accepted'
  | 'Rejected'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled'
  | 'NoCollectorAvailable'
  | 'PickupLocationUnresolved';

export interface Job {
  jobId: string;
  submissionId: string;
  collectorId: string | null;
  collectorName: string | null;
  status: JobStatus;

  pickupAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;

  /** The Analyzer's weight estimate; every re-match skips smaller vehicles. */
  requiredCapacityKg: number | null;
  scheduledWindowStart: string | null;
  scheduledWindowEnd: string | null;
  estimatedEtaMinutes: number | null;
  estimatedDistanceKm: number | null;

  photoUrl: string | null;
  measuredWeightKg: number | null;
  notes: string | null;
  rejectionReason: string | null;

  createdAt: string;
  respondedAt: string | null;
  /** When the collector tapped Navigate (Accepted -> InProgress). */
  startedAt: string | null;
  completedAt: string | null;
}

export type AssignmentOutcome = 'Assigned' | 'Accepted' | 'Rejected';

export interface JobHistoryEntry {
  historyId: string;
  collectorId: string;
  collectorName: string;
  outcome: AssignmentOutcome;
  reason: string | null;
  timestamp: string;
}

export interface Collector {
  collectorId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  vehicleType: string;
  capacityKg: number;
  isAvailable: boolean;
  rating: number;
  currentLatitude: number | null;
  currentLongitude: number | null;
  locationUpdatedAt: string | null;
  createdAt: string;
  activeJobCount: number;
  maxActiveJobs: number;
}

// A ranked candidate from matching (GET /collectors/available).
export interface CollectorMatch {
  collectorId: string;
  collectorName: string;
  vehicleType: string;
  capacityKg: number;
  rating: number;
  activeJobCount: number;
  distanceKm: number | null;
  etaMinutes: number | null;
}
