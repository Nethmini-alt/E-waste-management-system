# E-Waste mobile app (Flutter)

One app for every mobile user. The screen a person sees depends on their role:

| Role | Screens | Owner |
|---|---|---|
| Staff, Admin | Warehouse — Processing & Inventory (receive, inventory, dismantle, classify, QR scan) | Component C |
| Household, Corporate, Collector | "Coming soon" screen until their screens are added | Components A, B, D |

Paying collectors and managing rate policies stay on the web app (Admin only).

## Run it

1. Start the API (`backend/EWasteManagement.API`, `dotnet run`) — it listens on `http://localhost:5172`.
2. From this folder:

```bash
flutter pub get
flutter run                      # Android emulator: uses http://10.0.2.2:5172 automatically
flutter run -d chrome            # web: uses http://localhost:5172
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5172   # a real phone on your Wi-Fi
```

Sign in with a Staff or Admin account. Plain `http` is allowed in debug builds only.

## Structure

```
lib/
├── main.dart, app.dart
├── core/                 shared by every feature
│   ├── auth/             sign-in, session (secure storage), token expiry
│   ├── config/env.dart   API base URL
│   ├── network/          Dio client (JWT + 401 handling), API error messages
│   ├── router/           go_router + role-based redirects  ← add your role's home here
│   ├── theme/            colours and text styles copied from the web app
│   ├── utils/            formatting (Rs., kg, dates)
│   └── widgets/          glass card, buttons, notices, sheets, form fields
└── features/
    ├── auth/             sign-in screen
    └── warehouse/        Component C (data → application → presentation)
```

Add your component as `lib/features/<name>/` and reuse `core/` so every part looks the same.

## Rules shared with the backend

- Enums are **sent as numbers** in request bodies and **returned as strings** — see
  `features/warehouse/data/processing_enums.dart` (never reorder those enums).
- Inventory QR labels hold `EWI:{inventory item id}`.
- `flutter analyze` and `flutter test` must pass.
