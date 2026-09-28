import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'api_client.dart';

final uploadServiceProvider = Provider<UploadService>((ref) => UploadService(ref.watch(dioProvider)));

/// The one shared image upload endpoint (backend: Shared/Storage/UploadsController.cs) —
/// used for both submission item photos and job-completion photos. Mirrors the web app's
/// api/uploadApi.ts: pick a file, upload it here first, then use the returned URL.
class UploadService {
  UploadService(this._dio);

  final Dio _dio;

  /// Reads the file as bytes rather than by path, so this works the same way regardless of
  /// platform. Content type is worked out from the extension — the same 3 types the backend
  /// validator accepts (see UploadRequestValidator.cs).
  Future<String> uploadImage(XFile file) async {
    final bytes = await file.readAsBytes();
    final name = file.name.isNotEmpty ? file.name : 'photo.jpg';

    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: name, contentType: DioMediaType.parse(_contentTypeFor(name))),
    });

    final response = await _dio.post<Map<String, dynamic>>('/api/v1/uploads', data: formData);
    return response.data!['url'] as String;
  }

  static String _contentTypeFor(String fileName) {
    final ext = fileName.toLowerCase().split('.').last;
    return switch (ext) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };
  }
}
