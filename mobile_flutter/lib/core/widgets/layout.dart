import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// The ♻ gradient tile + "E-Waste." wordmark from the web sidebar and sign-in screen.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.showTagline = false});

  final bool showTagline;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(AppRadius.input),
            boxShadow: const [BoxShadow(color: Color(0x4D10B981), blurRadius: 12, offset: Offset(0, 4))],
          ),
          child: const Text('♻', style: TextStyle(color: Colors.white, fontSize: 16)),
        ),
        const SizedBox(width: 10),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text.rich(
              TextSpan(
                text: 'E-Waste',
                style: AppText.display(15, color: AppColors.ink800),
                children: [TextSpan(text: '.', style: AppText.display(15, color: AppColors.mint600))],
              ),
            ),
            if (showTagline)
              Text('MANAGEMENT SYSTEM', style: AppText.label.copyWith(fontSize: 9, letterSpacing: 2)),
          ],
        ),
      ],
    );
  }
}

/// Page title row (PageHeader in the web app): gradient icon tile, Sora title, subtitle, actions.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle, this.icon, this.actions = const []});

  final String title;
  final String? subtitle;
  final IconData? icon;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                gradient: AppColors.brandGradient,
                borderRadius: BorderRadius.circular(AppRadius.input),
                boxShadow: const [BoxShadow(color: Color(0x4D10B981), blurRadius: 10, offset: Offset(0, 4))],
              ),
              child: Icon(icon, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppText.display(22)),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(subtitle!, style: const TextStyle(fontSize: 14, color: AppColors.ink600)),
                ],
              ],
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}

/// `text-xs font-mono uppercase tracking-wide text-ink-600` label with its field underneath.
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child, this.help, this.helpColor});

  final String label;
  final Widget child;
  final String? help;
  final Color? helpColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: AppText.label),
        const SizedBox(height: 4),
        child,
        if (help != null) ...[
          const SizedBox(height: 4),
          Text(help!, style: TextStyle(fontSize: 12, color: helpColor ?? AppColors.ink600, height: 1.35)),
        ],
      ],
    );
  }
}

/// Section title inside a card.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.icon, this.trailing});

  final String text;
  final IconData? icon;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, size: 16, color: AppColors.mint600), const SizedBox(width: 8)],
          Expanded(child: Text(text, style: AppText.display(16))),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Keeps content at a readable width on tablets and the web, full width on phones.
class ResponsiveCenter extends StatelessWidget {
  const ResponsiveCenter({super.key, required this.child, this.maxWidth = 760});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(constraints: BoxConstraints(maxWidth: maxWidth), child: child),
    );
  }
}
