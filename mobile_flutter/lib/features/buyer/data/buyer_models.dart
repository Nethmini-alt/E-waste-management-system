class BuyerRegistration {
  const BuyerRegistration({required this.status});

  final String status;

  factory BuyerRegistration.fromJson(Map<String, dynamic> json) => BuyerRegistration(status: json['status'] as String? ?? 'Pending');
}

class MaterialRequest {
  const MaterialRequest({
    required this.id,
    required this.materialType,
    required this.quantityKg,
    required this.status,
    required this.createdAt,
    this.commercialPlanId,
    this.salesOrderId,
    this.lastMatchingNote,
  });

  final String id;
  final String materialType;
  final double quantityKg;
  final String status;
  final DateTime createdAt;
  final String? commercialPlanId;
  final String? salesOrderId;
  final String? lastMatchingNote;

  bool get canCancel => const {'Waiting', 'WaitingForPrice', 'PlanGenerationFailed'}.contains(status);

  factory MaterialRequest.fromJson(Map<String, dynamic> json) => MaterialRequest(
        id: json['materialRequestId'] as String,
        materialType: json['materialType'] as String? ?? 'Material',
        quantityKg: (json['quantityKg'] as num? ?? 0).toDouble(),
        status: json['status'] as String? ?? 'Waiting',
        createdAt: DateTime.parse(json['createdAt'] as String),
        commercialPlanId: json['commercialPlanId'] as String?,
        salesOrderId: json['salesOrderId'] as String?,
        lastMatchingNote: json['lastMatchingNote'] as String?,
      );
}