import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// The web app's backdrop: the faint circuit-board grid (`.circuit-bg`, 42px squares on #f4faf7)
/// with soft blurred colour blobs (`.bg-blob`). Static rather than animated to save battery.
///
/// [blobOpacity] follows the web: 0.35 on the sign-in screen, 0.18 inside the app shell.
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, this.blobOpacity = 0.18, this.showYellowBlob = false});

  final double blobOpacity;
  final bool showYellowBlob;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: ColoredBox(
          color: AppColors.canvas,
          child: Stack(
            children: [
              const Positioned.fill(child: CustomPaint(painter: _CircuitGridPainter())),
              _Blob(top: -120, left: -100, size: 480, color: AppColors.blobMint, opacity: blobOpacity, focus: const Alignment(-0.4, -0.4)),
              _Blob(bottom: -140, right: -80, size: 420, color: AppColors.blobTeal, opacity: blobOpacity, focus: const Alignment(0.2, 0.2)),
              if (showYellowBlob)
                _Blob(topFraction: 0.4, leftFraction: 0.6, size: 320, color: AppColors.blobYellow, opacity: 0.2, focus: Alignment.center),
            ],
          ),
        ),
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({
    this.top,
    this.left,
    this.bottom,
    this.right,
    this.topFraction,
    this.leftFraction,
    required this.size,
    required this.color,
    required this.opacity,
    required this.focus,
  });

  final double? top, left, bottom, right, topFraction, leftFraction;
  final double size;
  final Color color;
  final double opacity;
  final Alignment focus;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context);
    final blob = Opacity(
      opacity: opacity,
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 60, sigmaY: 60, tileMode: TileMode.decal),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(center: focus, colors: [color, color.withValues(alpha: 0)], stops: const [0, 0.7]),
          ),
        ),
      ),
    );
    return Positioned(
      top: topFraction != null ? screen.height * topFraction! : top,
      left: leftFraction != null ? screen.width * leftFraction! : left,
      bottom: bottom,
      right: right,
      child: blob,
    );
  }
}

class _CircuitGridPainter extends CustomPainter {
  const _CircuitGridPainter();

  static const _cell = 42.0;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.gridLine
      ..strokeWidth = 1;
    for (var x = 0.0; x <= size.width; x += _cell) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (var y = 0.0; y <= size.height; y += _cell) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _CircuitGridPainter oldDelegate) => false;
}
