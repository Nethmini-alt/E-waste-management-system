import 'package:dio/dio.dart';

/// Turns whatever the API (or the network) throws into one sentence for the UI.
/// A port of the web app's utils/apiError.ts, so both apps show the same messages.
///
/// The backend answers with:
///  - ProblemDetails from GlobalExceptionHandler:            { title, detail, status }
///  - ValidationProblemDetails from FluentValidation:         { title, status, errors: { Field: [msg] } }
///  - a bare string for Unauthorized("...")
///  - { message } from the Auth and Collection controllers
String apiErrorMessage(Object error, [String fallback = 'Something went wrong. Please try again.']) {
  if (error is String) return error.isEmpty ? fallback : error;
  if (error is! DioException) return fallback;

  final response = error.response;
  if (response == null) {
    return switch (error.type) {
      DioExceptionType.connectionError ||
      DioExceptionType.connectionTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.sendTimeout =>
        'Cannot reach the server. Check that the API is running and try again.',
      _ => fallback,
    };
  }

  final status = response.statusCode;
  final data = response.data;

  if (data is String && data.trim().isNotEmpty) return data;

  if (data is Map) {
    final errors = data['errors'];
    if (errors is Map && errors.isNotEmpty) {
      final messages = <String>[];
      errors.forEach((field, msgs) {
        final list = msgs is List ? msgs.map((m) => '$m') : ['$msgs'];
        for (final m in list) {
          messages.add(field is String && field.isNotEmpty ? '${_prettyField(field)}: $m' : m);
        }
      });
      if (messages.isNotEmpty) {
        const max = 3;
        final shown = messages.take(max).join(' • ');
        return messages.length > max ? '$shown (+${messages.length - max} more)' : shown;
      }
    }

    // A 5xx "detail" is an exception message — show the friendly title instead.
    if (status != null && status >= 500) return (data['title'] as String?) ?? fallback;

    for (final key in const ['detail', 'message', 'title']) {
      final value = data[key];
      if (value is String && value.isNotEmpty) return value;
    }
  }

  return switch (status) {
    401 => 'Your session has expired. Please sign in again.',
    403 => 'You do not have permission to do this.',
    404 => 'The requested resource was not found.',
    _ => fallback,
  };
}

int? apiErrorStatus(Object error) => error is DioException ? error.response?.statusCode : null;

String _prettyField(String field) => field
    .replaceAllMapped(RegExp(r'\[(\d+)\]'), (m) => ' ${int.parse(m[1]!) + 1}')
    .replaceAll('.', ' › ')
    .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
    .trim();
