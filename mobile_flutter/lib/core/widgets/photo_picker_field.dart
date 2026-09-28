import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../network/api_error.dart';
import '../network/upload_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Pick a photo, upload it through the shared /api/v1/uploads endpoint, and hand back the
/// returned URL — the same "pick, then upload, then store the URL" flow as the web app's
/// SubmitPage. Used for both a submission item's photo and a job's completion photo.
class PhotoPickerField extends ConsumerStatefulWidget {
  const PhotoPickerField({
    super.key,
    required this.imageUrl,
    required this.onChanged,
    this.label = 'Add photo (optional)',
  });

  /// The uploaded URL, or null/empty if no photo has been chosen yet.
  final String? imageUrl;

  /// Called with the new URL once an upload succeeds, or null when the photo is removed.
  final ValueChanged<String?> onChanged;

  final String label;

  @override
  ConsumerState<PhotoPickerField> createState() => _PhotoPickerFieldState();
}

class _PhotoPickerFieldState extends ConsumerState<PhotoPickerField> {
  bool _uploading = false;
  String? _error;

  Future<void> _pick(ImageSource source) async {
    final file = await ImagePicker().pickImage(source: source, imageQuality: 85);
    if (file == null || !mounted) return;

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final url = await ref.read(uploadServiceProvider).uploadImage(file);
      if (mounted) widget.onChanged(url);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Could not upload the photo.'));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _showSourceSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.camera, color: AppColors.mint600),
              title: const Text('Take a photo'),
              onTap: () {
                Navigator.of(context).pop();
                _pick(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(LucideIcons.image, color: AppColors.mint600),
              title: const Text('Choose from gallery'),
              onTap: () {
                Navigator.of(context).pop();
                _pick(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = widget.imageUrl != null && widget.imageUrl!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasImage)
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.input),
                child: Image.network(
                  widget.imageUrl!,
                  width: 96,
                  height: 96,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 96,
                    height: 96,
                    color: AppColors.ink100,
                    child: const Icon(LucideIcons.imageOff, color: AppColors.ink600),
                  ),
                ),
              ),
              Positioned(
                top: -6,
                right: -6,
                child: IconButton(
                  onPressed: _uploading ? null : () => widget.onChanged(null),
                  icon: const Icon(LucideIcons.circleX, size: 20, color: AppColors.red600),
                  style: IconButton.styleFrom(backgroundColor: Colors.white, padding: EdgeInsets.zero),
                ),
              ),
            ],
          )
        else
          OutlinedButton.icon(
            onPressed: _uploading ? null : _showSourceSheet,
            icon: _uploading
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(LucideIcons.camera, size: 16),
            label: Text(_uploading ? 'Uploading…' : widget.label),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.ink800,
              side: BorderSide(color: AppColors.ink100),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.input)),
            ),
          ),
        if (_error != null) ...[
          const SizedBox(height: 4),
          Text(_error!, style: const TextStyle(color: AppColors.red600, fontSize: 12)),
        ],
      ],
    );
  }
}
