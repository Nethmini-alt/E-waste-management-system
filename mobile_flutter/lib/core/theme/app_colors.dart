import 'package:flutter/material.dart';

/// The same palette as the React web app (frontend-react/project/tailwind.config.js and
/// theme.css), so the mobile and web screens look like one product. Tailwind's own colours
/// that the web app uses (sky, amber, orange, violet, red, teal) are copied here by value.
abstract final class AppColors {
  // ---- mint (brand) ------------------------------------------------------
  static const mint50 = Color(0xFFECFDF5);
  static const mint100 = Color(0xFFD1FAE5);
  static const mint200 = Color(0xFFA7F3D0);
  static const mint300 = Color(0xFF6EE7B7);
  static const mint400 = Color(0xFF34D399);
  static const mint500 = Color(0xFF10B981);
  static const mint600 = Color(0xFF059669);
  static const mint700 = Color(0xFF047857);
  static const mint800 = Color(0xFF065F46);
  static const mint900 = Color(0xFF064E3B);

  // ---- ink (text / neutrals) ---------------------------------------------
  static const ink50 = Color(0xFFF4F6F5);
  static const ink100 = Color(0xFFE6EAE8);
  static const ink600 = Color(0xFF4B6259);
  static const ink800 = Color(0xFF233128);
  static const ink900 = Color(0xFF0B1512);

  // ---- background (.circuit-bg / .bg-blob) --------------------------------
  static const canvas = Color(0xFFF4FAF7);
  static const gridLine = Color(0x12059669); // rgba(5,150,105,0.07)
  static const blobMint = Color(0xFF34D399);
  static const blobTeal = Color(0xFF2DD4BF);
  static const blobYellow = Color(0xFFFACC15);

  // ---- glass surface (.glass) --------------------------------------------
  static const glassFill = Color(0x77FFFFFF); // rgba(255,255,255,0.466)
  static const glassBorder = Color(0x80FFFFFF); // rgba(255,255,255,0.5)
  static const glassShadow = Color(0x2E059669); // rgba(5,150,105,0.18)
  static const inputFill = Color(0xB3FFFFFF); // bg-white/70
  static const tileFill = Color(0x99FFFFFF); // bg-white/60

  // ---- Tailwind colours used by badges and notices -------------------------
  static const sky50 = Color(0xFFF0F9FF);
  static const sky100 = Color(0xFFE0F2FE);
  static const sky200 = Color(0xFFBAE6FD);
  static const sky500 = Color(0xFF0EA5E9);
  static const sky800 = Color(0xFF075985);

  static const amber50 = Color(0xFFFFFBEB);
  static const amber100 = Color(0xFFFEF3C7);
  static const amber200 = Color(0xFFFDE68A);
  static const amber500 = Color(0xFFF59E0B);
  static const amber700 = Color(0xFFB45309);
  static const amber800 = Color(0xFF92400E);
  static const amber900 = Color(0xFF78350F);

  static const orange100 = Color(0xFFFFEDD5);
  static const orange500 = Color(0xFFF97316);
  static const orange800 = Color(0xFF9A3412);

  static const violet100 = Color(0xFFEDE9FE);
  static const violet500 = Color(0xFF8B5CF6);
  static const violet800 = Color(0xFF5B21B6);

  static const red50 = Color(0xFFFEF2F2);
  static const red100 = Color(0xFFFEE2E2);
  static const red200 = Color(0xFFFECACA);
  static const red500 = Color(0xFFEF4444);
  static const red600 = Color(0xFFDC2626);
  static const red700 = Color(0xFFB91C1C);
  static const red800 = Color(0xFF991B1B);
  static const red900 = Color(0xFF7F1D1D);

  static const teal100 = Color(0xFFCCFBF1);
  static const teal800 = Color(0xFF115E59);

  /// `.btn-glass`: linear-gradient(135deg, #10b981, #047857).
  static const primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [mint500, mint700],
  );

  /// The brand tile gradient (`from-mint-400 to-mint-700`).
  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [mint400, mint700],
  );
}
