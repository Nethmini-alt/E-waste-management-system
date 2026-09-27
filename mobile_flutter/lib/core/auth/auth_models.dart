/// The signed-in user, from POST /api/auth/login (AuthResponse on the backend).
class AuthUser {
  const AuthUser({required this.userId, required this.email, required this.fullName, required this.role});

  final String userId;
  final String email;
  final String fullName;

  /// "Household" | "Corporate" | "Collector" | "Staff" | "Admin" — the backend's UserRole names.
  final String role;

  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isStaffOrAdmin => const {'staff', 'admin'}.contains(role.toLowerCase());

  /// Household or Corporate — the two roles that submit e-waste.
  bool get isGenerator => const {'household', 'corporate'}.contains(role.toLowerCase());
  bool get isCollector => role.toLowerCase() == 'collector';

  String get firstName => fullName.trim().split(RegExp(r'\s+')).first;

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        userId: json['userId'] as String,
        email: json['email'] as String,
        fullName: json['fullName'] as String? ?? '',
        role: json['role'] as String,
      );

  Map<String, dynamic> toJson() => {'userId': userId, 'email': email, 'fullName': fullName, 'role': role};
}

enum AuthStatus { restoring, signedOut, signedIn }

class AuthState {
  const AuthState._(this.status, {this.user, this.token, this.signedOutReason});

  const AuthState.restoring() : this._(AuthStatus.restoring);
  const AuthState.signedOut({String? reason}) : this._(AuthStatus.signedOut, signedOutReason: reason);
  const AuthState.signedIn(AuthUser user, String token) : this._(AuthStatus.signedIn, user: user, token: token);

  final AuthStatus status;
  final AuthUser? user;
  final String? token;

  /// Why the user was signed out (e.g. the session expired), shown on the sign-in screen.
  final String? signedOutReason;
}
