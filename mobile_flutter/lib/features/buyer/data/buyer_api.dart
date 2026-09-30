import 'package:dio/dio.dart';

import 'buyer_models.dart';

class BuyerApi {
  BuyerApi(this._dio);

  final Dio _dio;

  Future<BuyerRegistration> register({
    required String fullName,
    required String email,
    required String password,
    required String phoneNumber,
    required String companyName,
    required String contactPerson,
    required String address,
    required String buyerType,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>('/api/buyers/register', data: {
      'fullName': fullName.trim(),
      'email': email.trim(),
      'password': password,
      'phoneNumber': phoneNumber.trim(),
      'companyName': companyName.trim(),
      'contactPerson': contactPerson.trim(),
      'address': address.trim(),
      'buyerType': buyerType,
    });
    return BuyerRegistration.fromJson(response.data!);
  }

  Future<List<MaterialRequest>> myRequests() async {
    final response = await _dio.get<List<dynamic>>('/api/material-requests/mine');
    return response.data!.map((item) => MaterialRequest.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> requestMaterial({required String materialType, required double quantityKg}) async {
    await _dio.post<void>('/api/material-requests', data: {'materialType': materialType.trim(), 'quantityKg': quantityKg});
  }

  Future<void> cancelRequest(String requestId) async {
    await _dio.post<void>('/api/material-requests/$requestId/cancel');
  }
}