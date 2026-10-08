// Component C — TC-C-F03 / F06 / F08: warehouse screens with a mocked API (mocktail).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mocktail/mocktail.dart';
import 'package:mobile_flutter/features/warehouse/application/warehouse_providers.dart';
import 'package:mobile_flutter/features/warehouse/data/processing_enums.dart';
import 'package:mobile_flutter/features/warehouse/data/warehouse_api.dart';
import 'package:mobile_flutter/features/warehouse/data/warehouse_models.dart';
import 'package:mobile_flutter/features/warehouse/presentation/inventory/inventory_list_screen.dart';
import 'package:mobile_flutter/features/warehouse/presentation/inventory/material_stock_screen.dart';
import 'package:mobile_flutter/features/warehouse/presentation/receive/receive_screen.dart';

class MockWarehouseApi extends Mock implements WarehouseApi {}

ReceivableJob job(String id, String collectorId, String name) => ReceivableJob.fromJson({
      'jobId': id,
      'collectorId': collectorId,
      'collectorName': name,
      'collectorVehicleType': 'Lorry',
      'pickupAddress': '$id Galle Road',
      'reportedWeightKg': 11.8,
      'items': [
        {'submissionItemId': '$id-i', 'itemName': 'Old laptop', 'quantity': 1, 'suggestedItemType': 'Laptop'},
      ],
    });

Map<String, dynamic> item(String id, String type) => {
      'id': id,
      'itemType': type,
      'status': 'Received',
      'originType': 'JobCollection',
      'kind': 'Unit',
      'verifiedWeightKg': 11.5,
      'currentLocationName': 'Receiving Bay',
      'receivedAt': '2026-10-08T05:00:00Z',
    };

PagedResponse<InventoryListItem> page(List<Map<String, dynamic>> items) => PagedResponse<InventoryListItem>.fromJson(
      {'items': items, 'page': 1, 'pageSize': 20, 'totalCount': items.length, 'totalPages': items.isEmpty ? 0 : 1},
      InventoryListItem.fromJson,
    );

MaterialStockGroup stock(String type, double total, double available) => MaterialStockGroup.fromJson({
      'materialType': type,
      'totalWeightKg': total,
      'availableWeightKg': available,
      'items': [],
    });

Future<void> pumpScreen(WidgetTester tester, Widget screen, MockWarehouseApi api) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    // Riverpod 3 retries failed providers automatically; off here so error states are deterministic.
    retry: (_, __) => null,
    overrides: [warehouseApiProvider.overrideWithValue(api)],
    child: MaterialApp(home: Scaffold(body: screen)),
  ));
  await tester.pumpAndSettle();
}

void main() {
  late MockWarehouseApi api;

  setUpAll(() {
    // Tests run offline: use the fallback font instead of downloading Google Fonts.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  setUp(() => api = MockWarehouseApi());

  group('TC-C-F03 receive screen', () {
    testWidgets('lists the collectors who have completed jobs waiting', (tester) async {
      when(() => api.receivableJobs()).thenAnswer((_) async => [
            job('job-1', 'col-1', 'Kamal Perera'),
            job('job-2', 'col-1', 'Kamal Perera'),
            job('job-3', 'col-2', 'Nimal Silva'),
          ]);

      await pumpScreen(tester, const ReceiveScreen(), api);

      expect(find.text('Who is delivering? Tap their name.'), findsOneWidget);
      expect(find.text('Kamal Perera'), findsOneWidget); // two jobs, one card
      expect(find.text('Nimal Silva'), findsOneWidget);
    });

    testWidgets('says when there is nothing to receive', (tester) async {
      when(() => api.receivableJobs()).thenAnswer((_) async => []);

      await pumpScreen(tester, const ReceiveScreen(), api);

      expect(find.text('Nothing to receive right now'), findsOneWidget);
    });

    testWidgets('shows the error and loads again on "Try again"', (tester) async {
      var calls = 0;
      when(() => api.receivableJobs()).thenAnswer((_) async {
        calls++;
        if (calls == 1) throw Exception('offline');
        return [job('job-1', 'col-1', 'Kamal Perera')];
      });

      await pumpScreen(tester, const ReceiveScreen(), api);
      expect(find.text('Try again'), findsOneWidget);

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Kamal Perera'), findsOneWidget);
    });
  });

  group('TC-C-F06 inventory list', () {
    testWidgets('shows items, and the kind filter asks the API for materials only', (tester) async {
      when(() => api.listInventory(search: any(named: 'search'), status: any(named: 'status'), kind: any(named: 'kind'), page: any(named: 'page')))
          .thenAnswer((inv) async {
        final kind = inv.namedArguments[#kind] as ItemKind?;
        return kind == null ? page([item('i-1', 'Laptop'), item('i-2', 'Battery')]) : page([]);
      });

      await pumpScreen(tester, const InventoryListScreen(), api);
      expect(find.text('Laptop'), findsOneWidget);
      expect(find.text('Battery'), findsOneWidget);

      await tester.tap(find.text('Materials'));
      await tester.pumpAndSettle();

      verify(() => api.listInventory(search: any(named: 'search'), status: any(named: 'status'), kind: ItemKind.material, page: 1)).called(1);
      expect(find.text('Laptop'), findsNothing);
      expect(find.text('No items match'), findsOneWidget);
      // The Materials view links to the per-material stock totals.
      expect(find.text('See the total weight of each material'), findsOneWidget);
    });

    testWidgets('says when there is no inventory yet', (tester) async {
      when(() => api.listInventory(search: any(named: 'search'), status: any(named: 'status'), kind: any(named: 'kind'), page: any(named: 'page')))
          .thenAnswer((_) async => page([]));

      await pumpScreen(tester, const InventoryListScreen(), api);

      expect(find.text('No inventory yet'), findsOneWidget);
    });
  });

  group('TC-C-F08 material stock', () {
    testWidgets('lists each material and totals the weight', (tester) async {
      when(() => api.materialStock()).thenAnswer((_) async => [stock('Copper', 2.5, 0.5), stock('Aluminium', 10, 10)]);

      await pumpScreen(tester, const MaterialStockScreen(), api);

      expect(find.text('Copper'), findsOneWidget);
      expect(find.text('Aluminium'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);        // number of materials
      expect(find.text('12.5 kg'), findsOneWidget);  // total weight
    });

    testWidgets('says when there are no materials in stock', (tester) async {
      when(() => api.materialStock()).thenAnswer((_) async => []);

      await pumpScreen(tester, const MaterialStockScreen(), api);

      expect(find.text('No materials in stock'), findsOneWidget);
    });
  });
}
