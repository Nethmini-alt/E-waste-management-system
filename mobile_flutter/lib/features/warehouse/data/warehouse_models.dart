import 'processing_enums.dart';

// Response shapes of the Processing API (camelCase JSON from ASP.NET). Numbers may arrive as int
// or double, so every decimal goes through [_d].

double _d(Object? v) => (v as num).toDouble();
double? _dOrNull(Object? v) => v == null ? null : (v as num).toDouble();

class PagedResponse<T> {
  const PagedResponse({required this.items, required this.page, required this.totalCount, required this.totalPages});

  final List<T> items;
  final int page;
  final int totalCount;
  final int totalPages;

  factory PagedResponse.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) item) => PagedResponse(
        items: (json['items'] as List).map((e) => item(e as Map<String, dynamic>)).toList(),
        page: json['page'] as int,
        totalCount: json['totalCount'] as int,
        totalPages: json['totalPages'] as int,
      );
}

// ---- lookups ------------------------------------------------------------------

class WarehouseLocation {
  const WarehouseLocation({required this.id, required this.name, this.description});

  final String id;
  final String name;
  final String? description;

  factory WarehouseLocation.fromJson(Map<String, dynamic> j) =>
      WarehouseLocation(id: j['id'] as String, name: j['name'] as String, description: j['description'] as String?);
}

class RatePolicy {
  const RatePolicy({required this.id, required this.itemType, required this.ratePerKg, required this.isActive});

  final String id;
  final String itemType;
  final double ratePerKg;
  final bool isActive;

  factory RatePolicy.fromJson(Map<String, dynamic> j) => RatePolicy(
        id: j['id'] as String,
        itemType: j['itemType'] as String,
        ratePerKg: _d(j['ratePerKg']),
        isActive: j['isActive'] as bool,
      );
}

class CollectorLookup {
  const CollectorLookup({required this.collectorId, required this.fullName, required this.vehicleType});

  final String collectorId;
  final String fullName;
  final String vehicleType;

  factory CollectorLookup.fromJson(Map<String, dynamic> j) => CollectorLookup(
        collectorId: j['collectorId'] as String,
        fullName: j['fullName'] as String,
        vehicleType: j['vehicleType'] as String? ?? '',
      );
}

// ---- inventory ----------------------------------------------------------------

class InventoryListItem {
  const InventoryListItem({
    required this.id,
    required this.itemType,
    required this.status,
    required this.originType,
    required this.verifiedWeightKg,
    required this.currentLocationName,
    required this.parentInventoryItemId,
    required this.category,
    required this.receivedAt,
  });

  final String id;
  final String itemType;
  final InventoryStatus status;
  final OriginType? originType;
  final double verifiedWeightKg;
  final String currentLocationName;
  final String? parentInventoryItemId;
  final ClassificationCategory? category;
  final String receivedAt;

  factory InventoryListItem.fromJson(Map<String, dynamic> j) => InventoryListItem(
        id: j['id'] as String,
        itemType: j['itemType'] as String,
        status: InventoryStatus.fromApi(j['status'] as String),
        originType: OriginType.tryFromApi(j['originType'] as String?),
        verifiedWeightKg: _d(j['verifiedWeightKg']),
        currentLocationName: j['currentLocationName'] as String? ?? '',
        parentInventoryItemId: j['parentInventoryItemId'] as String?,
        category: ClassificationCategory.tryFromApi(j['category'] as String?),
        receivedAt: j['receivedAt'] as String,
      );
}

class InventoryClassification {
  const InventoryClassification({
    required this.category,
    required this.subCategory,
    required this.source,
    required this.confidenceScore,
    required this.isFinal,
    required this.classifiedAt,
  });

  final ClassificationCategory? category;
  final String? subCategory;
  final ClassificationSource? source;
  final double? confidenceScore;
  final bool isFinal;
  final String classifiedAt;

  factory InventoryClassification.fromJson(Map<String, dynamic> j) => InventoryClassification(
        category: ClassificationCategory.tryFromApi(j['category'] as String?),
        subCategory: j['subCategory'] as String?,
        source: ClassificationSource.tryFromApi(j['source'] as String?),
        confidenceScore: _dOrNull(j['confidenceScore']),
        isFinal: j['isFinal'] as bool? ?? false,
        classifiedAt: j['classifiedAt'] as String,
      );
}

class InventoryChild {
  const InventoryChild({required this.id, required this.itemType, required this.status, required this.verifiedWeightKg});

  final String id;
  final String itemType;
  final InventoryStatus status;
  final double verifiedWeightKg;

  factory InventoryChild.fromJson(Map<String, dynamic> j) => InventoryChild(
        id: j['id'] as String,
        itemType: j['itemType'] as String,
        status: InventoryStatus.fromApi(j['status'] as String),
        verifiedWeightKg: _d(j['verifiedWeightKg']),
      );
}

class InventoryDetail {
  const InventoryDetail({
    required this.id,
    required this.itemType,
    required this.status,
    required this.originType,
    required this.verifiedWeightKg,
    required this.currentLocationId,
    required this.currentLocationName,
    required this.jobId,
    required this.extraWasteReceiptId,
    required this.parentInventoryItemId,
    required this.receivedAt,
    required this.classification,
    required this.children,
  });

  final String id;
  final String itemType;
  final InventoryStatus status;
  final OriginType? originType;
  final double verifiedWeightKg;
  final String currentLocationId;
  final String currentLocationName;
  final String? jobId;
  final String? extraWasteReceiptId;
  final String? parentInventoryItemId;
  final String receivedAt;
  final InventoryClassification? classification;
  final List<InventoryChild> children;

  factory InventoryDetail.fromJson(Map<String, dynamic> j) => InventoryDetail(
        id: j['id'] as String,
        itemType: j['itemType'] as String,
        status: InventoryStatus.fromApi(j['status'] as String),
        originType: OriginType.tryFromApi(j['originType'] as String?),
        verifiedWeightKg: _d(j['verifiedWeightKg']),
        currentLocationId: j['currentLocationId'] as String,
        currentLocationName: j['currentLocationName'] as String? ?? '',
        jobId: j['jobId'] as String?,
        extraWasteReceiptId: j['extraWasteReceiptId'] as String?,
        parentInventoryItemId: j['parentInventoryItemId'] as String?,
        receivedAt: j['receivedAt'] as String,
        classification: j['classification'] == null
            ? null
            : InventoryClassification.fromJson(j['classification'] as Map<String, dynamic>),
        children: ((j['children'] as List?) ?? const [])
            .map((c) => InventoryChild.fromJson(c as Map<String, dynamic>))
            .toList(),
      );
}

class ProcessingLogEntry {
  const ProcessingLogEntry({required this.action, required this.performedByStaffId, required this.performedAt, this.notes});

  final String action;
  final String performedByStaffId;
  final String performedAt;
  final String? notes;

  factory ProcessingLogEntry.fromJson(Map<String, dynamic> j) => ProcessingLogEntry(
        action: j['action'] as String,
        performedByStaffId: j['performedByStaffId'] as String,
        performedAt: j['performedAt'] as String,
        notes: j['notes'] as String?,
      );
}

// ---- action results -------------------------------------------------------------

class DismantleResult {
  const DismantleResult({required this.updatedWeightKg, required this.lossKg, required this.childIds});

  final double? updatedWeightKg;
  final double lossKg;
  final List<String> childIds;

  factory DismantleResult.fromJson(Map<String, dynamic> j) => DismantleResult(
        updatedWeightKg: _dOrNull(j['updatedWeightKg']),
        lossKg: _dOrNull(j['lossKg']) ?? 0,
        childIds: (j['childInventoryItemIds'] as List).cast<String>(),
      );
}

class ClassificationValidation {
  const ClassificationValidation({required this.approved, required this.requiresHumanReview, required this.reasons});

  final bool approved;
  final bool requiresHumanReview;
  final List<String> reasons;

  factory ClassificationValidation.fromJson(Map<String, dynamic> j) => ClassificationValidation(
        approved: j['approved'] as bool,
        requiresHumanReview: j['requiresHumanReview'] as bool,
        reasons: ((j['reasons'] as List?) ?? const []).cast<String>(),
      );
}

class ClassificationResult {
  const ClassificationResult({required this.category, required this.status});

  final ClassificationCategory? category;

  /// OnHold when the backend quarantined a Hazardous item automatically.
  final InventoryStatus status;

  factory ClassificationResult.fromJson(Map<String, dynamic> j) => ClassificationResult(
        category: ClassificationCategory.tryFromApi(j['category'] as String?),
        status: InventoryStatus.fromApi(j['status'] as String),
      );
}

// ---- receiving ----------------------------------------------------------------

/// A completed job with a collector that has not been received yet (server-side filter).
class ReceivableJob {
  const ReceivableJob({
    required this.jobId,
    required this.collectorId,
    required this.collectorName,
    required this.collectorVehicleType,
    required this.pickupAddress,
    required this.reportedWeightKg,
    required this.estimatedDistanceKm,
    required this.completedAt,
    required this.submissionCategory,
    required this.suggestedItemType,
  });

  final String jobId;
  final String collectorId;
  final String? collectorName;
  final String? collectorVehicleType;
  final String pickupAddress;
  final double? reportedWeightKg;
  final double? estimatedDistanceKm;
  final String? completedAt;
  final String? submissionCategory;

  /// The submission category matched to the item-type list; null when staff must choose.
  final String? suggestedItemType;

  String get collectorLabel {
    final name = collectorName;
    if (name == null || name.isEmpty) return 'Collector ${collectorId.substring(0, 8)}…';
    final vehicle = collectorVehicleType;
    return vehicle == null || vehicle.isEmpty ? name : '$name · $vehicle';
  }

  factory ReceivableJob.fromJson(Map<String, dynamic> j) => ReceivableJob(
        jobId: j['jobId'] as String,
        collectorId: j['collectorId'] as String,
        collectorName: j['collectorName'] as String?,
        collectorVehicleType: j['collectorVehicleType'] as String?,
        pickupAddress: j['pickupAddress'] as String? ?? '',
        reportedWeightKg: _dOrNull(j['reportedWeightKg']),
        estimatedDistanceKm: _dOrNull(j['estimatedDistanceKm']),
        completedAt: j['completedAt'] as String?,
        submissionCategory: j['submissionCategory'] as String?,
        suggestedItemType: j['suggestedItemType'] as String?,
      );
}

class ReceiveJobResult {
  const ReceiveJobResult({
    required this.inventoryItemId,
    required this.itemType,
    required this.verifiedWeightKg,
    required this.reportedWeightKg,
    required this.discrepancyKg,
  });

  final String inventoryItemId;
  final String itemType;
  final double verifiedWeightKg;
  final double? reportedWeightKg;
  final double? discrepancyKg;

  factory ReceiveJobResult.fromJson(Map<String, dynamic> j) => ReceiveJobResult(
        inventoryItemId: j['inventoryItemId'] as String,
        itemType: j['itemType'] as String? ?? '',
        verifiedWeightKg: _d(j['verifiedWeightKg']),
        reportedWeightKg: _dOrNull(j['reportedWeightKg']),
        discrepancyKg: _dOrNull(j['discrepancyKg']),
      );
}

class ExtraWasteLineInput {
  const ExtraWasteLineInput({required this.itemType, required this.weightKg, required this.accepted, this.rejectionReason});

  final String itemType;
  final double weightKg;
  final bool accepted;
  final String? rejectionReason;
}

class ExtraWasteLineResult {
  const ExtraWasteLineResult({required this.itemType, required this.accepted, this.rejectionReason, this.inventoryItemId});

  final String itemType;
  final bool accepted;
  final String? rejectionReason;
  final String? inventoryItemId;

  factory ExtraWasteLineResult.fromJson(Map<String, dynamic> j) => ExtraWasteLineResult(
        itemType: j['itemType'] as String,
        accepted: j['accepted'] as bool,
        rejectionReason: j['rejectionReason'] as String?,
        inventoryItemId: j['inventoryItemId'] as String?,
      );
}

class ExtraWasteReceiptResult {
  const ExtraWasteReceiptResult({required this.receiptId, required this.items});

  final String receiptId;
  final List<ExtraWasteLineResult> items;

  factory ExtraWasteReceiptResult.fromJson(Map<String, dynamic> j) => ExtraWasteReceiptResult(
        receiptId: j['extraWasteReceiptId'] as String,
        items: (j['items'] as List).map((e) => ExtraWasteLineResult.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
