namespace EWasteManagement.API.Features.Auth.Entities;

// IMPORTANT: Only append new roles at the end of this list.
// The database CHECK constraint enforces these exact lowercase values:
//   'household', 'corporate', 'collector', 'staff', 'admin'
// Inserting a role in the middle will silently reassign existing users' roles.

public enum UserRole
{
    Household,
    Corporate,
    Collector,
    Staff,
    Admin
}