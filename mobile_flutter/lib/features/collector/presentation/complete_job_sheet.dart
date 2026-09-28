import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_sheet.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/form_fields.dart';
import '../../../core/widgets/layout.dart';
import '../../../core/widgets/photo_picker_field.dart';
import '../application/collector_providers.dart';

/// Photo (via the shared upload endpoint), measured weight and notes — POST
/// /api/v1/jobs/{id}/complete. Pops with `true` once the job is marked complete.
class CompleteJobSheet extends ConsumerStatefulWidget {
  const CompleteJobSheet({super.key, required this.jobId});

  final String jobId;

  @override
  ConsumerState<CompleteJobSheet> createState() => _CompleteJobSheetState();
}

class _CompleteJobSheetState extends ConsumerState<CompleteJobSheet> {
  final _weight = TextEditingController();
  final _notes = TextEditingController();
  String? _photoUrl;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _weight.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final weight = parseDecimal(_weight.text);
    if (_photoUrl == null || _photoUrl!.isEmpty) {
      setState(() => _error = 'Add a photo of the collected items.');
      return;
    }
    if (weight == null || weight <= 0) {
      setState(() => _error = 'Enter the measured weight.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(collectorApiProvider).complete(
            widget.jobId,
            photoUrl: _photoUrl!,
            measuredWeightKg: weight,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Could not complete the job.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppSheet(
      title: 'Complete job',
      subtitle: 'Photo, measured weight and any notes for this pickup.',
      busy: _submitting,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LabeledField(
            label: 'Photo',
            child: PhotoPickerField(imageUrl: _photoUrl, onChanged: (url) => setState(() => _photoUrl = url), label: 'Add photo'),
          ),
          const SizedBox(height: 16),
          LabeledField(label: 'Measured weight', child: DecimalField(controller: _weight, hint: '0.0')),
          const SizedBox(height: 16),
          LabeledField(
            label: 'Notes (optional)',
            child: TextFormField(controller: _notes, minLines: 2, maxLines: 4),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Notice(tone: NoticeTone.error, message: _error),
          ],
        ],
      ),
      footer: [
        AppButton.secondary(label: 'Cancel', onPressed: _submitting ? null : () => Navigator.of(context).pop()),
        AppButton(label: _submitting ? 'Submitting…' : 'Mark complete', loading: _submitting, onPressed: _submit),
      ],
    );
  }
}
