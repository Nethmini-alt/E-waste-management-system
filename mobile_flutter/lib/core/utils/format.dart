import 'package:intl/intl.dart';

/// Display helpers — the same conventions as the web app's utils/format.ts.
abstract final class Format {
  static final _money = NumberFormat('#,##0.00', 'en_US');
  static final _weight = NumberFormat('#,##0.##', 'en_US');
  static final _dateTime = DateFormat('MMM d, y, h:mm a');
  static final _date = DateFormat('MMM d, y');

  /// "Rs. 1,234.50" — same currency prefix as the Sales and Processing pages.
  static String money(num amount) => 'Rs. ${_money.format(amount)}';

  static String kg(num kg) => '${_weight.format(kg)} kg';

  /// Signed difference with an explicit +, for weight discrepancies.
  static String signedKg(num kg) => '${kg > 0 ? '+' : ''}${_weight.format(kg)} kg';

  /// ASP.NET sends UTC timestamps without a zone when their Kind is Unspecified. Treat any
  /// zone-less timestamp as UTC so it is not shown in the wrong time.
  static DateTime? parseApiDate(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final hasZone = RegExp(r'(Z|[+-]\d{2}:?\d{2})$', caseSensitive: false).hasMatch(iso);
    return DateTime.tryParse(hasZone ? iso : '${iso}Z')?.toLocal();
  }

  static String dateTime(String? iso) {
    final d = parseApiDate(iso);
    return d == null ? '—' : _dateTime.format(d);
  }

  static String date(String? iso) {
    final d = parseApiDate(iso);
    return d == null ? '—' : _date.format(d);
  }

  /// "3fa85f64…" — enough of a GUID to recognise it without filling the screen.
  static String shortId(String? id) => id == null || id.isEmpty ? '—' : '${id.substring(0, id.length < 8 ? id.length : 8)}…';
}
