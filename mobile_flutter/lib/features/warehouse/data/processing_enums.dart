/// The backend's Processing enums — a port of the web app's processingEnums.ts.
///
/// The API RETURNS enums as strings ("Sorting") but only ACCEPTS numbers in request bodies (no
/// JsonStringEnumConverter is registered), so each value keeps its C# declaration order as
/// [index]. Append-only, never reorder — it must match
/// backend/.../Features/Processing/Entities/Enums.cs.
library;

enum InventoryStatus {
  received('Received', 'Received'),
  sorting('Sorting', 'Sorting'),
  dismantling('Dismantling', 'Dismantling'),
  classified('Classified', 'Classified'),
  readyForSale('ReadyForSale', 'Ready for sale'),
  // Named differently from the "Export-grade" category so the two are never confused.
  exportOnly('ExportOnly', 'Reserved for export'),
  onHold('OnHold', 'On hold');

  const InventoryStatus(this.apiName, this.label);

  final String apiName;
  final String label;

  /// The number to send in a request body.
  int get apiValue => index;

  static InventoryStatus fromApi(String name) =>
      values.firstWhere((s) => s.apiName == name, orElse: () => throw FormatException('Unknown status $name'));

  /// Mirror of InventoryItem.AllowedTransitions. The server stays the source of truth; this only
  /// hides actions that could never succeed.
  List<InventoryStatus> get allowedNext => switch (this) {
        received => const [sorting],
        sorting => const [dismantling, classified],
        dismantling => const [classified],
        classified => const [readyForSale, exportOnly, onHold],
        readyForSale || exportOnly || onHold => const [],
      };

  bool get isTerminal => allowedNext.isEmpty;

  /// Dismantle steps are only accepted while an item is being sorted or dismantled.
  bool get canDismantle => this == sorting || this == dismantling;

  /// Classifying is only accepted from Sorting/Dismantling, and is the only way to reach Classified.
  bool get canClassify => this == sorting || this == dismantling;

  /// Transitions the plain status endpoint may perform: Classified is reached only through
  /// /classify and Dismantling by logging the first dismantle step. From Classified, only the
  /// category's outcome and On hold (ClassificationOutcomeRules on the backend).
  List<InventoryStatus> manualTransitions(ClassificationCategory? category) => allowedNext
      .where((next) => next != classified && next != dismantling)
      .where((next) => this != classified || next == onHold || category?.outcome == next)
      .toList();

  /// The warehouse area this status normally lives in (seeded location names). Only used to
  /// pre-select the location when changing status; staff can always pick another.
  String? get suggestedLocationName => switch (this) {
        sorting => 'Sorting Area',
        readyForSale => 'Ready-for-Sale Storage',
        exportOnly => 'Export Storage',
        onHold => 'Hazardous Hold Area',
        _ => null,
      };
}

enum ClassificationCategory {
  reusable('Reusable', 'Reusable', 'Can be refurbished or reused as it is. Next step: ready for sale.'),
  localRecyclable('LocalRecyclable', 'Local recyclable', 'Can be recycled through local partners. Next step: ready for sale.'),
  hazardous('Hazardous', 'Hazardous',
      'Contains hazardous material (batteries, CRT glass, mercury, lead…). Quarantined automatically.'),
  exportOnly('ExportOnly', 'Export-grade', 'Can only be handled through export channels. Next step: reserved for export.');

  const ClassificationCategory(this.apiName, this.label, this.help);

  final String apiName;
  final String label;
  final String help;

  int get apiValue => index;

  /// The outcome the category leads to; Hazardous has none (it goes on hold automatically).
  InventoryStatus? get outcome => switch (this) {
        reusable || localRecyclable => InventoryStatus.readyForSale,
        exportOnly => InventoryStatus.exportOnly,
        hazardous => null,
      };

  static ClassificationCategory? tryFromApi(String? name) =>
      values.where((c) => c.apiName == name).firstOrNull;
}

enum ClassificationSource {
  manual('Manual', 'Manual'),
  ai('Ai', 'AI-assisted');

  const ClassificationSource(this.apiName, this.label);

  final String apiName;
  final String label;

  int get apiValue => index;

  static ClassificationSource? tryFromApi(String? name) => values.where((s) => s.apiName == name).firstOrNull;
}

enum OriginType {
  jobCollection('JobCollection', 'Job collection'),
  extraWaste('ExtraWaste', 'Extra waste');

  const OriginType(this.apiName, this.label);

  final String apiName;
  final String label;

  static OriginType? tryFromApi(String? name) => values.where((o) => o.apiName == name).firstOrNull;
}

/// "GeneralCollection" is the rate that prices the weight part of a job payment. It is not a real
/// item type, so it is never offered as an extra-waste item (the backend rejects it too).
const jobPaymentRateKey = 'GeneralCollection';

bool isReservedItemType(String itemType) => itemType.trim().toLowerCase() == jobPaymentRateKey.toLowerCase();

/// Backend limits, so forms agree with the API validators.
abstract final class Limits {
  static const notes = 1000;
  static const subCategory = 100;
  static const itemType = 50;
  static const rejectionReason = 500;
  static const search = 100;
  static const pageSize = 20;
}

/// ClassificationValidationService flags anything below this for human review.
const lowConfidenceThreshold = 0.7;

/// What an inventory QR label holds: "EWI:" + the inventory item id. The prefix lets the scanner
/// ignore any other QR code it sees. A bare id is accepted too (e.g. typed in by hand).
const inventoryQrPrefix = 'EWI:';

String inventoryQrData(String itemId) => '$inventoryQrPrefix$itemId';

final _guid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', caseSensitive: false);

/// The inventory item id in a scanned/typed value, or null if it isn't one of our labels.
String? parseInventoryQr(String? raw) {
  if (raw == null) return null;
  var value = raw.trim();
  if (value.toUpperCase().startsWith(inventoryQrPrefix)) value = value.substring(inventoryQrPrefix.length).trim();
  return _guid.hasMatch(value) ? value.toLowerCase() : null;
}
