import 'package:dio/dio.dart';

import 'processing_enums.dart';
import 'warehouse_models.dart';

/// The Processing endpoints the warehouse app uses — the same calls as the web app's
/// inventoryApi / receiveApi / lookupApi. Only existing endpoints; nothing here pays collectors
/// or changes rates (those stay on the web, Admin-only).
///
/// Query-string enums go by name (model binding accepts names); request-BODY enums go as
/// numbers because the backend has no JsonStringEnumConverter.
class WarehouseApi {
  WarehouseApi(this._dio);

  final Dio _dio;

  static const _inventory = '/api/v1/inventory';
  static const _lookups = '/api/v1/inventory/lookups';

  Future<List<T>> _getList<T>(String path, T Function(Map<String, dynamic>) map, [Map<String, dynamic>? query]) async {
    final r = await _dio.get<List<dynamic>>(path, queryParameters: query);
    return r.data!.map((e) => map(e as Map<String, dynamic>)).toList();
  }

  // ---- lookups ------------------------------------------------------------

  Future<List<WarehouseLocation>> warehouseLocations() =>
      _getList('$_lookups/warehouse-locations', WarehouseLocation.fromJson);

  /// Active rates only — the extra-waste form offers only types that can actually be paid.
  Future<List<RatePolicy>> activeRatePolicies() =>
      _getList('$_lookups/rate-policies', RatePolicy.fromJson, {'activeOnly': true});

  /// Types a job item or a dismantled component may be given.
  Future<List<String>> itemTypes() async {
    final r = await _dio.get<List<dynamic>>('$_lookups/item-types');
    return r.data!.cast<String>();
  }

  Future<List<CollectorLookup>> collectors() => _getList('$_lookups/collectors', CollectorLookup.fromJson);

  // ---- inventory --------------------------------------------------------------

  Future<PagedResponse<InventoryListItem>> listInventory({
    String? search,
    InventoryStatus? status,
    int page = 1,
    int pageSize = Limits.pageSize,
  }) async {
    final r = await _dio.get<Map<String, dynamic>>(_inventory, queryParameters: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (status != null) 'status': status.apiName,
      'sortBy': 'CreatedAt',
      'descending': true,
      'page': page,
      'pageSize': pageSize,
    });
    return PagedResponse.fromJson(r.data!, InventoryListItem.fromJson);
  }

  Future<InventoryDetail> getItem(String id) async {
    final r = await _dio.get<Map<String, dynamic>>('$_inventory/$id');
    return InventoryDetail.fromJson(r.data!);
  }

  Future<List<ProcessingLogEntry>> history(String id) => _getList('$_inventory/$id/history', ProcessingLogEntry.fromJson);

  Future<void> transition(String id, InventoryStatus next, {String? notes, String? newLocationId}) async {
    await _dio.put<void>('$_inventory/$id/status', data: {
      'nextStatus': next.apiValue,
      'notes': (notes?.trim().isEmpty ?? true) ? null : notes!.trim(),
      'newLocationId': newLocationId,
    });
  }

  Future<DismantleResult> addDismantleLog(
    String id, {
    required String description,
    double? remainingWeightKg,
    required List<({String itemType, double weightKg})> components,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>('$_inventory/$id/dismantle-log', data: {
      'description': description.trim(),
      'remainingWeightKg': remainingWeightKg,
      'childItems': [
        for (final c in components) {'itemType': c.itemType.trim(), 'weightKg': c.weightKg},
      ],
    });
    return DismantleResult.fromJson(r.data!);
  }

  /// Dry-run check with no side effects — the web app requires it before classifying, so we do too.
  Future<ClassificationValidation> validateClassification(
    String id, {
    required ClassificationCategory category,
    String? subCategory,
    double? confidenceScore,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>('$_inventory/$id/validate-classification', data: {
      'proposedCategory': category.apiValue,
      'proposedSubCategory': (subCategory?.trim().isEmpty ?? true) ? null : subCategory!.trim(),
      'confidenceScore': confidenceScore,
    });
    return ClassificationValidation.fromJson(r.data!);
  }

  Future<ClassificationResult> classify(
    String id, {
    required ClassificationCategory category,
    String? subCategory,
    required ClassificationSource source,
    double? confidenceScore,
    required bool isFinal,
  }) async {
    final r = await _dio.put<Map<String, dynamic>>('$_inventory/$id/classify', data: {
      'category': category.apiValue,
      'subCategory': (subCategory?.trim().isEmpty ?? true) ? null : subCategory!.trim(),
      'source': source.apiValue,
      'confidenceScore': confidenceScore,
      'isFinal': isFinal,
    });
    return ClassificationResult.fromJson(r.data!);
  }

  Future<void> moveLocation(String id, String newLocationId) async {
    await _dio.put<void>('$_inventory/$id/location', data: {'newLocationId': newLocationId});
  }

  // ---- receiving ----------------------------------------------------------------

  Future<List<ReceivableJob>> receivableJobs() =>
      _getList('$_inventory/job-collection/receivable', ReceivableJob.fromJson);

  Future<ReceiveJobResult> receiveJob({
    required String jobId,
    required String collectorId,
    required String warehouseLocationId,
    required double verifiedWeightKg,
    required String itemType,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>('$_inventory/job-collection/receive', data: {
      'jobId': jobId,
      'collectorId': collectorId,
      'warehouseLocationId': warehouseLocationId,
      'verifiedWeightKg': verifiedWeightKg,
      'itemType': itemType,
    });
    return ReceiveJobResult.fromJson(r.data!);
  }

  /// [idempotencyKey]: a retry with the same key returns the original receipt instead of creating
  /// (and paying for) a second one — important on a flaky phone connection.
  Future<ExtraWasteReceiptResult> receiveExtraWaste({
    required String collectorId,
    required String warehouseLocationId,
    String? notes,
    required String idempotencyKey,
    required List<ExtraWasteLineInput> lines,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>('$_inventory/extra-waste/receive', data: {
      'collectorId': collectorId,
      'warehouseLocationId': warehouseLocationId,
      'notes': (notes?.trim().isEmpty ?? true) ? null : notes!.trim(),
      'idempotencyKey': idempotencyKey,
      'items': [
        for (final l in lines)
          {
            'itemType': l.itemType.trim(),
            'weightKg': l.weightKg,
            'accepted': l.accepted,
            'rejectionReason': l.accepted ? null : l.rejectionReason?.trim(),
          },
      ],
    });
    return ExtraWasteReceiptResult.fromJson(r.data!);
  }
}
