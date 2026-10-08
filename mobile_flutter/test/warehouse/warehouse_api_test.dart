// Component C — TC-C-F02: the warehouse API client sends exactly what the backend expects.
// A fake Dio adapter captures each request, so no server or network is needed.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/core/network/api_error.dart';
import 'package:mobile_flutter/features/warehouse/data/processing_enums.dart';
import 'package:mobile_flutter/features/warehouse/data/warehouse_api.dart';
import 'package:mobile_flutter/features/warehouse/data/warehouse_models.dart';

class FakeAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  int status = 200;
  Object? body = const <String, dynamic>{};

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    return ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late FakeAdapter adapter;
  late WarehouseApi api;

  setUp(() {
    adapter = FakeAdapter();
    api = WarehouseApi(Dio(BaseOptions(baseUrl: 'http://api.test'))..httpClientAdapter = adapter);
  });

  RequestOptions last() => adapter.requests.last;

  group('TC-C-F02 warehouse API requests', () {
    test('status change sends the status as its backend number and blank notes as null', () async {
      await api.transition('item-1', InventoryStatus.sorting, notes: '   ');

      expect(last().method, 'PUT');
      expect(last().path, '/api/v1/inventory/item-1/status');
      expect(last().data, {'nextStatus': 1, 'notes': null, 'newLocationId': null});
    });

    test('inventory list sends filters by name, trims the search and omits a blank one', () async {
      adapter.body = {'items': [], 'page': 1, 'pageSize': 20, 'totalCount': 0, 'totalPages': 0};

      await api.listInventory(search: '  lap ', status: InventoryStatus.readyForSale, kind: ItemKind.material, page: 2);
      expect(last().queryParameters, containsPair('search', 'lap'));
      expect(last().queryParameters, containsPair('status', 'ReadyForSale'));
      expect(last().queryParameters, containsPair('kind', 'Material'));
      expect(last().queryParameters, containsPair('page', 2));

      await api.listInventory(search: '   ');
      expect(last().queryParameters.containsKey('search'), isFalse);
    });

    test('receiving a delivery sends one request with every job line', () async {
      adapter.body = {'deliveryId': 'd-1', 'collectorId': 'col-1', 'receivedAt': '2026-10-08T05:00:00Z', 'jobs': [], 'totalPendingAmount': 482.5};

      await api.receiveDelivery(
        collectorId: 'col-1',
        warehouseLocationId: 'loc-1',
        jobs: [
          DeliveryJobInput.items(jobId: 'job-1', items: [
            DeliveryItemInput(submissionItemId: 'i-1', receivedQuantity: 1, itemType: 'Laptop', verifiedWeightKg: 11.5),
          ]),
        ],
      );

      expect(last().path, '/api/v1/inventory/job-collection/receive-delivery');
      final data = last().data as Map<String, dynamic>;
      expect(data['collectorId'], 'col-1');
      expect(data['warehouseLocationId'], 'loc-1');
      expect((data['jobs'] as List).single['jobId'], 'job-1');
    });

    test('extra-waste receipt trims item types and only rejected lines keep a reason', () async {
      adapter.body = {'receiptId': 'r-1'};

      try {
        await api.receiveExtraWaste(
          collectorId: 'col-1',
          warehouseLocationId: 'loc-1',
          notes: ' ',
          idempotencyKey: 'key-1',
          lines: [
            ExtraWasteLineInput(itemType: '  Laptop ', weightKg: 3, accepted: true, rejectionReason: 'dropped'),
            ExtraWasteLineInput(itemType: 'Battery', weightKg: 1, accepted: false, rejectionReason: '  Leaking  '),
          ],
        );
      } catch (_) {
        // The fake response is minimal; only the request body matters here.
      }

      final data = last().data as Map<String, dynamic>;
      expect(data['notes'], isNull);
      expect(data['idempotencyKey'], 'key-1');
      expect(data['items'], [
        {'itemType': 'Laptop', 'weightKg': 3, 'accepted': true, 'rejectionReason': null},
        {'itemType': 'Battery', 'weightKg': 1, 'accepted': false, 'rejectionReason': 'Leaking'},
      ]);
    });

    test('a dismantle step trims names and sends components and materials', () async {
      adapter.body = {'inventoryItemId': 'item-1', 'updatedWeightKg': 9, 'lossKg': 0, 'childInventoryItemIds': [], 'materialInventoryItemIds': ['m-1']};

      await api.addDismantleLog('item-1',
          description: ' Stripped copper ',
          components: [(itemType: ' Battery ', weightKg: 1.0)],
          materials: [(materialType: ' Copper ', weightKg: 2.5, hazardous: false)]);

      expect(last().data, {
        'description': 'Stripped copper',
        'remainingWeightKg': null,
        'childItems': [{'itemType': 'Battery', 'weightKg': 1.0}],
        'materials': [{'materialType': 'Copper', 'weightKg': 2.5, 'hazardous': false}],
      });
    });

    test('a 409 from the server becomes a readable message for the worker', () async {
      adapter
        ..status = 409
        ..body = {'title': 'Job already received', 'detail': "Job 'job-1' has already been received into inventory."};

      Object? error;
      try {
        await api.transition('item-1', InventoryStatus.sorting);
      } catch (e) {
        error = e;
      }

      expect(error, isA<DioException>());
      expect(apiErrorStatus(error!), 409);
      expect(apiErrorMessage(error), "Job 'job-1' has already been received into inventory.");
    });

    test('lookups parse plain string lists', () async {
      adapter.body = ['Battery', 'Laptop'];
      expect(await api.itemTypes(), ['Battery', 'Laptop']);
    });
  });
}
