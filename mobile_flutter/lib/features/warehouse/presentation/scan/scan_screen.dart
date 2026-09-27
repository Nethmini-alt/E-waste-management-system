import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../core/widgets/glass_card.dart';
import '../../../../core/widgets/layout.dart';
import '../../data/processing_enums.dart';
import '../warehouse_shell.dart';

/// Scan an inventory QR label (EWI:{item id}) to open the item. The item ID can also be typed or
/// pasted when a label is damaged.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _manual = TextEditingController();
  bool _visible = true;
  String? _manualError;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The shell keeps every tab alive; a hidden tab has tickers disabled. Only build the camera
    // while this tab is on screen, so the camera is switched off as soon as the user leaves.
    final visible = TickerMode.valuesOf(context).enabled;
    if (visible != _visible) setState(() => _visible = visible);
  }

  @override
  void dispose() {
    _manual.dispose();
    super.dispose();
  }

  void _openItem(String id) => context.go('/warehouse/inventory/$id');

  void _submitManual() {
    final id = parseInventoryQr(_manual.text);
    if (id == null) {
      setState(() => _manualError = 'That is not an inventory item ID. It looks like 3fa85f64-5717-4562-b3fc-2c963f66afa6.');
      return;
    }
    setState(() => _manualError = null);
    _manual.clear();
    _openItem(id);
  }

  @override
  Widget build(BuildContext context) {
    return WarehousePage(
      children: [
        const PageHeader(title: 'Scan item', subtitle: 'Point the camera at an inventory QR label.', icon: LucideIcons.scanQrCode),
        GlassCard(
          padding: const EdgeInsets.all(12),
          child: AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.tile),
              child: _visible ? _CameraView(onItem: _openItem) : const ColoredBox(color: AppColors.ink900),
            ),
          ),
        ),
        const SizedBox(height: 14),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SectionTitle('Label damaged?', icon: LucideIcons.keyboard),
              LabeledField(
                label: 'Item ID',
                child: TextField(
                  controller: _manual,
                  autocorrect: false,
                  textInputAction: TextInputAction.go,
                  onSubmitted: (_) => _submitManual(),
                  style: AppText.mono.copyWith(fontSize: 13),
                  decoration: const InputDecoration(hintText: 'Paste or type the item ID'),
                ),
              ),
              if (_manualError != null) ...[const SizedBox(height: 10), Notice(tone: NoticeTone.error, message: _manualError)],
              const SizedBox(height: 12),
              AppButton(label: 'Open item', icon: LucideIcons.arrowRight, expand: true, onPressed: _submitManual),
            ],
          ),
        ),
      ],
    );
  }
}

/// Owns the camera. Created only while the Scan tab is visible and disposed when it is not.
class _CameraView extends StatefulWidget {
  const _CameraView({required this.onItem});

  final ValueChanged<String> onItem;

  @override
  State<_CameraView> createState() => _CameraViewState();
}

class _CameraViewState extends State<_CameraView> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  bool _handled = false;
  DateTime _lastWarning = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final id = parseInventoryQr(barcode.rawValue);
      if (id != null) {
        _handled = true; // one navigation per scan, however many frames still contain the code
        widget.onItem(id);
        return;
      }
    }
    // A QR code that isn't one of our labels — say so, but not on every frame.
    if (capture.barcodes.isNotEmpty && DateTime.now().difference(_lastWarning) > const Duration(seconds: 3)) {
      _lastWarning = DateTime.now();
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('That QR code is not an inventory label.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
          errorBuilder: (context, error) => _CameraError(error: error),
        ),
        // Viewfinder frame in the brand colour.
        IgnorePointer(
          child: Center(
            child: FractionallySizedBox(
              widthFactor: 0.62,
              heightFactor: 0.62,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.mint400, width: 3),
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          right: 8,
          top: 8,
          child: IconButton.filled(
            tooltip: 'Torch',
            style: IconButton.styleFrom(backgroundColor: Colors.black45),
            onPressed: () => _controller.toggleTorch(),
            icon: const Icon(LucideIcons.flashlight, size: 18, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

class _CameraError extends StatelessWidget {
  const _CameraError({required this.error});

  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final message = switch (error.errorCode) {
      MobileScannerErrorCode.permissionDenied => 'Camera permission was denied. Allow camera access in the phone settings to scan labels.',
      MobileScannerErrorCode.unsupported => 'This device has no supported camera. Type the item ID below instead.',
      _ => 'The camera could not start. Type the item ID below instead.',
    };
    return ColoredBox(
      color: AppColors.ink900,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.cameraOff, size: 32, color: Colors.white70),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 14)),
            ],
          ),
        ),
      ),
    );
  }
}
