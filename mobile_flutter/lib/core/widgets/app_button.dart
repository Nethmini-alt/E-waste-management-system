import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

enum AppButtonVariant {
  /// `.btn-glass`: the green gradient pill.
  primary,

  /// `.btn-glass-light`: translucent white with a mint border.
  secondary,

  /// `btnDanger`: solid red.
  danger,
}

/// The web app's pill buttons (btnPrimary / btnSecondary / btnDanger), with a loading state.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.variant = AppButtonVariant.primary,
    this.loading = false,
    this.expand = false,
    this.small = false,
  });

  const AppButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = false,
    this.small = false,
  }) : variant = AppButtonVariant.secondary;

  const AppButton.danger({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = false,
    this.small = false,
  }) : variant = AppButtonVariant.danger;

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final AppButtonVariant variant;
  final bool loading;
  final bool expand;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    final foreground = variant == AppButtonVariant.secondary ? AppColors.mint800 : Colors.white;

    final BoxDecoration decoration = switch (variant) {
      AppButtonVariant.primary => const BoxDecoration(
          gradient: AppColors.primaryGradient,
          borderRadius: BorderRadius.all(Radius.circular(999)),
          boxShadow: [BoxShadow(color: Color(0x8C059669), blurRadius: 25, spreadRadius: -8, offset: Offset(0, 10))],
        ),
      AppButtonVariant.secondary => BoxDecoration(
          color: Colors.white.withValues(alpha: 0.6),
          borderRadius: const BorderRadius.all(Radius.circular(999)),
          border: Border.all(color: AppColors.mint600.withValues(alpha: 0.25)),
        ),
      AppButtonVariant.danger => const BoxDecoration(
          color: AppColors.red600,
          borderRadius: BorderRadius.all(Radius.circular(999)),
          boxShadow: [BoxShadow(color: Color(0x33EF4444), blurRadius: 12, offset: Offset(0, 4))],
        ),
    };

    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: foreground),
          )
        else if (icon != null)
          Icon(icon, size: small ? 14 : 16, color: foreground),
        if (loading || icon != null) const SizedBox(width: 8),
        Flexible(
          child: Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: foreground, fontWeight: FontWeight.w600, fontSize: small ? 12 : 14),
          ),
        ),
      ],
    );

    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: DecoratedBox(
        decoration: decoration,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: enabled ? onPressed : null,
            customBorder: const StadiumBorder(),
            splashColor: foreground.withValues(alpha: 0.15),
            child: ConstrainedBox(
              // 48dp touch target on phones, as warehouse staff may wear gloves.
              constraints: BoxConstraints(minHeight: small ? 36 : 48),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: small ? 14 : 20, vertical: small ? 8 : 12),
                child: Center(widthFactor: 1, child: content),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
