import 'package:dio/dio.dart';

import 'submission_models.dart';

/// The two submitter-facing endpoints (Household/Corporate) — everything else on
/// SubmissionsController is Staff/Admin. Owner and user type come from the JWT on the
/// backend, never from this body.
class SubmissionsApi {
  SubmissionsApi(this._dio);

  final Dio _dio;

  Future<SubmissionResponse> create({
    required String category,
    required double estimatedWeight,
    required String pickupAddress,
    required String phoneNumber,
    required List<SubmissionItemDraft> items,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/submissions', data: {
      'category': category,
      'estimatedWeight': estimatedWeight,
      'pickupAddress': pickupAddress,
      'phoneNumber': phoneNumber,
      'items': [
        for (final i in items) {'itemName': i.itemName, 'description': i.description, 'imageUrl': i.imageUrl ?? ''},
      ],
    });
    return SubmissionResponse.fromJson(response.data!);
  }

  Future<SubmissionResponse> getById(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/submissions/$id');
    return SubmissionResponse.fromJson(response.data!);
  }

  Future<List<SubmissionResponse>> mine() async {
    final response = await _dio.get<List<dynamic>>('/api/v1/submissions/mine');
    return response.data!.map((e) => SubmissionResponse.fromJson(e as Map<String, dynamic>)).toList();
  }
}
