import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

const _goodStatuses = {'CollectorAssigned', 'Collected'};
const _badStatuses = {'Rejected', 'Failed', 'Cancelled'};

/// Same colour rule as the web app's AdminReviewPage/MySubmissionsPage statusBadge().
class SubmissionStatusBadge extends StatelessWidget {
  const SubmissionStatusBadge({super.key, required this.status, required this.label});

  final String status;
  final String label;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (status) {
      _ when _goodStatuses.contains(status) => (AppColors.mint50, AppColors.mint800),
      _ when _badStatuses.contains(status) => (AppColors.red50, AppColors.red800),
      _ => (AppColors.amber50, AppColors.amber900),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(color: foreground, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}
