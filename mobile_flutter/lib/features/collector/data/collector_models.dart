/// CollectorResponseDto.
class CollectorProfile {
  const CollectorProfile({
    required this.collectorId,
    required this.vehicleType,
    required this.capacityKg,
    required this.isAvailable,
    required this.rating,
    this.currentLatitude,
    this.currentLongitude,
    required this.activeJobCount,
    required this.maxActiveJobs,
  });

  final String collectorId;
  final String vehicleType;
  final double capacityKg;
  final bool isAvailable;
  final double rating;
  final double? currentLatitude;
  final double? currentLongitude;
  final int activeJobCount;
  final int maxActiveJobs;

  CollectorProfile copyWith({bool? isAvailable}) => CollectorProfile(
        collectorId: collectorId,
        vehicleType: vehicleType,
        capacityKg: capacityKg,
        isAvailable: isAvailable ?? this.isAvailable,
        rating: rating,
        currentLatitude: currentLatitude,
        currentLongitude: currentLongitude,
        activeJobCount: activeJobCount,
        maxActiveJobs: maxActiveJobs,
      );

  factory CollectorProfile.fromJson(Map<String, dynamic> json) => CollectorProfile(
        collectorId: json['collectorId'] as String,
        vehicleType: json['vehicleType'] as String? ?? '',
        capacityKg: (json['capacityKg'] as num?)?.toDouble() ?? 0,
        isAvailable: json['isAvailable'] as bool? ?? false,
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        currentLatitude: (json['currentLatitude'] as num?)?.toDouble(),
        currentLongitude: (json['currentLongitude'] as num?)?.toDouble(),
        activeJobCount: json['activeJobCount'] as int? ?? 0,
        maxActiveJobs: json['maxActiveJobs'] as int? ?? 3,
      );
}

/// JobStatus on the backend — Job.cs / Features/Collection/Entities/JobStatus.cs. Serialized
/// as the exact C# member name (job.Status.ToString()), so these strings must match exactly.
enum JobStatus {
  assigned('Assigned'),
  accepted('Accepted'),
  rejected('Rejected'),
  inProgress('InProgress'),
  completed('Completed'),
  cancelled('Cancelled'),
  noCollectorAvailable('NoCollectorAvailable'),
  pickupLocationUnresolved('PickupLocationUnresolved');

  const JobStatus(this.apiValue);
  final String apiValue;

  static JobStatus? fromApi(String? value) {
    for (final status in JobStatus.values) {
      if (status.apiValue == value) return status;
    }
    return null;
  }
}

/// JobResponseDto.
class CollectionJob {
  const CollectionJob({
    required this.jobId,
    required this.status,
    required this.pickupAddress,
    this.pickupLatitude,
    this.pickupLongitude,
    this.requiredCapacityKg,
    this.estimatedEtaMinutes,
    this.estimatedDistanceKm,
    this.photoUrl,
    this.measuredWeightKg,
    this.notes,
    this.rejectionReason,
    required this.createdAt,
  });

  final String jobId;
  final JobStatus status;
  final String pickupAddress;
  final double? pickupLatitude;
  final double? pickupLongitude;
  final double? requiredCapacityKg;
  final int? estimatedEtaMinutes;
  final double? estimatedDistanceKm;
  final String? photoUrl;
  final double? measuredWeightKg;
  final String? notes;
  final String? rejectionReason;
  final DateTime createdAt;

  factory CollectionJob.fromJson(Map<String, dynamic> json) => CollectionJob(
        jobId: json['jobId'] as String,
        status: JobStatus.fromApi(json['status'] as String?) ?? JobStatus.assigned,
        pickupAddress: json['pickupAddress'] as String? ?? '',
        pickupLatitude: (json['pickupLatitude'] as num?)?.toDouble(),
        pickupLongitude: (json['pickupLongitude'] as num?)?.toDouble(),
        requiredCapacityKg: (json['requiredCapacityKg'] as num?)?.toDouble(),
        estimatedEtaMinutes: json['estimatedEtaMinutes'] as int?,
        estimatedDistanceKm: (json['estimatedDistanceKm'] as num?)?.toDouble(),
        photoUrl: json['photoUrl'] as String?,
        measuredWeightKg: (json['measuredWeightKg'] as num?)?.toDouble(),
        notes: json['notes'] as String?,
        rejectionReason: json['rejectionReason'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
