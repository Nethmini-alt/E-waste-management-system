import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_client.dart';
import '../data/processing_enums.dart';
import '../data/warehouse_api.dart';
import '../data/warehouse_models.dart';

final warehouseApiProvider = Provider<WarehouseApi>((ref) => WarehouseApi(ref.watch(dioProvider)));

// ---- reference data -----------------------------------------------------------
// Barely changes, so it is fetched once and shared between screens (like the web's lookup hooks).
// Watching the signed-in user id drops the cache when a different person signs in.

void _resetOnUserChange(Ref ref) => ref.watch(authControllerProvider.select((s) => s.user?.userId));

final warehouseLocationsProvider = FutureProvider<List<WarehouseLocation>>((ref) {
  _resetOnUserChange(ref);
  return ref.watch(warehouseApiProvider).warehouseLocations();
});

/// Active rates without the reserved "GeneralCollection" job-payment key — the types that can
/// be accepted on an extra-waste receipt.
final extraWasteRatesProvider = FutureProvider<List<RatePolicy>>((ref) async {
  _resetOnUserChange(ref);
  final rates = await ref.watch(warehouseApiProvider).activeRatePolicies();
  return rates.where((r) => !isReservedItemType(r.itemType)).toList();
});

final itemTypesProvider = FutureProvider<List<String>>((ref) {
  _resetOnUserChange(ref);
  return ref.watch(warehouseApiProvider).itemTypes();
});

final collectorsProvider = FutureProvider<List<CollectorLookup>>((ref) {
  _resetOnUserChange(ref);
  return ref.watch(warehouseApiProvider).collectors();
});

// ---- screens --------------------------------------------------------------------

class WarehouseSummary {
  const WarehouseSummary({required this.statusCounts, required this.receivableJobs, required this.recentItems});

  final Map<InventoryStatus, int> statusCounts;
  final int receivableJobs;
  final List<InventoryListItem> recentItems;

  int get total => statusCounts.values.fold(0, (a, b) => a + b);
  int get inProgress =>
      (statusCounts[InventoryStatus.received] ?? 0) +
      (statusCounts[InventoryStatus.sorting] ?? 0) +
      (statusCounts[InventoryStatus.dismantling] ?? 0);
  int get readyToHandOff =>
      (statusCounts[InventoryStatus.readyForSale] ?? 0) + (statusCounts[InventoryStatus.exportOnly] ?? 0);
}

/// Built from the existing list endpoints, the same way the web dashboard is: a page of size 1
/// per status is enough to read its totalCount.
final warehouseSummaryProvider = FutureProvider.autoDispose<WarehouseSummary>((ref) async {
  final api = ref.watch(warehouseApiProvider);
  final countsFuture = Future.wait(
    InventoryStatus.values.map((s) => api.listInventory(status: s, pageSize: 1).then((p) => MapEntry(s, p.totalCount))),
  );
  final recentFuture = api.listInventory(pageSize: 6);
  final receivableFuture = api.receivableJobs();

  final counts = await countsFuture;
  return WarehouseSummary(
    statusCounts: Map.fromEntries(counts),
    receivableJobs: (await receivableFuture).length,
    recentItems: (await recentFuture).items,
  );
});

final receivableJobsProvider = FutureProvider.autoDispose<List<ReceivableJob>>(
  (ref) => ref.watch(warehouseApiProvider).receivableJobs(),
);

class ItemDetailData {
  const ItemDetailData(this.item, this.history);

  final InventoryDetail item;
  final List<ProcessingLogEntry> history;
}

final itemDetailProvider = FutureProvider.autoDispose.family<ItemDetailData, String>((ref, id) async {
  final api = ref.watch(warehouseApiProvider);
  final results = await Future.wait([api.getItem(id), api.history(id)]);
  return ItemDetailData(results[0] as InventoryDetail, results[1] as List<ProcessingLogEntry>);
});
