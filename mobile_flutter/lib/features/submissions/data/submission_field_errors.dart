import 'package:dio/dio.dart';

/// Per-item field errors, keyed by the item's index in the submitted list.
class SubmissionItemFieldErrors {
  String? itemName;
  String? description;
  String? imageUrl;
}

/// Field-level errors from CreateSubmissionDtoValidator's 400 response, e.g.
/// { "PickupAddress": ["Pickup address is required."], "Items[0].ItemName": [...] } — a Dart
/// port of the web app's submissionErrors.ts, so they can be shown next to the field that
/// caused them instead of only as one combined message.
class SubmissionFieldErrors {
  String? category;
  String? estimatedWeight;
  String? pickupAddress;
  String? phoneNumber;
  String? itemsGeneral;
  final Map<int, SubmissionItemFieldErrors> items = {};
}

final _itemFieldKey = RegExp(r'^Items\[(\d+)]\.(\w+)$');

/// Returns field-level errors for a 400 with an `errors` object, otherwise null (a network
/// error, a 401/403/500, or any other shape the caller should show as one general message).
SubmissionFieldErrors? extractSubmissionFieldErrors(Object error) {
  if (error is! DioException || error.response?.statusCode != 400) return null;

  final data = error.response?.data;
  if (data is! Map) return null;
  final errors = data['errors'];
  if (errors is! Map || errors.isEmpty) return null;

  final result = SubmissionFieldErrors();

  errors.forEach((key, value) {
    final message = value is List ? (value.isEmpty ? null : '${value.first}') : (value == null ? null : '$value');
    if (message == null || key is! String) return;

    final itemMatch = _itemFieldKey.firstMatch(key);
    if (itemMatch != null) {
      final index = int.parse(itemMatch.group(1)!);
      final entry = result.items.putIfAbsent(index, SubmissionItemFieldErrors.new);
      switch (itemMatch.group(2)) {
        case 'ItemName':
          entry.itemName = message;
        case 'Description':
          entry.description = message;
        case 'ImageUrl':
          entry.imageUrl = message;
      }
      return;
    }

    switch (key) {
      case 'Category':
        result.category = message;
      case 'EstimatedWeight':
        result.estimatedWeight = message;
      case 'PickupAddress':
        result.pickupAddress = message;
      case 'PhoneNumber':
        result.phoneNumber = message;
      case 'Items':
        result.itemsGeneral = message;
    }
  });

  return result;
}
