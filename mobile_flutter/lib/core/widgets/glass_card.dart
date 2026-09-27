import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// The frosted "liquid glass" surface (`.glass rounded-3xl`, GlassCard in the web app):
/// translucent white, a light border, a soft mint shadow and an 18px backdrop blur.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.radius = AppRadius.card,
    this.onTap,
    this.margin,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    Widget content = Padding(padding: padding, child: child);
    if (onTap != null) {
      content = Material(
        type: MaterialType.transparency,
        child: InkWell(onTap: onTap, borderRadius: shape, splashColor: AppColors.mint100, child: content),
      );
    }

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: shape,
        boxShadow: const [BoxShadow(color: AppColors.glassShadow, blurRadius: 30, spreadRadius: -8, offset: Offset(0, 8))],
      ),
      child: ClipRRect(
        borderRadius: shape,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.glassFill,
              borderRadius: shape,
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}

/// The lighter inner tile used inside cards (`rounded-2xl border border-mint-100 bg-white/60`).
class Tile extends StatelessWidget {
  const Tile({super.key, required this.child, this.padding = const EdgeInsets.all(14), this.onTap, this.color});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(AppRadius.tile);
    return Material(
      color: color ?? AppColors.tileFill,
      shape: RoundedRectangleBorder(borderRadius: shape, side: const BorderSide(color: AppColors.mint100)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: AppColors.mint100,
        highlightColor: AppColors.mint50,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}
