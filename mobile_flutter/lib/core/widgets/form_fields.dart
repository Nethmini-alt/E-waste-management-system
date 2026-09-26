import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';

/// A dropdown styled like the web app's `<select className={inputClass}>`.
class AppDropdown<T> extends StatelessWidget {
  const AppDropdown({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
    this.hint,
    this.enabled = true,
  });

  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final String? hint;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final known = value != null && items.any((i) => i.value == value);
    return DropdownButtonFormField<T>(
      // Keyed on the value so an outside change (e.g. a pre-selection) is always shown.
      key: ValueKey(known ? value : null),
      initialValue: known ? value : null,
      items: items,
      isExpanded: true,
      onChanged: enabled ? onChanged : null,
      hint: hint == null ? null : Text(hint!, overflow: TextOverflow.ellipsis),
      borderRadius: BorderRadius.circular(12),
      dropdownColor: Colors.white,
      style: const TextStyle(fontSize: 14, color: AppColors.ink900),
      iconEnabledColor: AppColors.ink600,
    );
  }
}

/// Numbers with up to [decimals] decimal places, typed with the decimal keypad.
class DecimalField extends StatelessWidget {
  const DecimalField({
    super.key,
    required this.controller,
    this.hint,
    this.decimals = 2,
    this.onChanged,
    this.suffix = 'kg',
  });

  final TextEditingController controller;
  final String? hint;
  final int decimals;
  final ValueChanged<String>? onChanged;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp('^\\d*\\.?\\d{0,$decimals}'))],
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hint,
        suffixText: suffix,
        suffixStyle: const TextStyle(color: AppColors.ink600, fontSize: 13),
      ),
    );
  }
}

/// Parses a decimal field; null when it is empty or not a number.
double? parseDecimal(String text) {
  final t = text.trim();
  return t.isEmpty ? null : double.tryParse(t);
}
