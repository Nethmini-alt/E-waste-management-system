namespace EWasteManagement.API.Features.Auth.Entities;

// IMPORTANT: Only append new roles at the end of this list.
// EF Core stores this enum as an integer based on position.
// Inserting a role in the middle will silently reassign existing users' roles.

public enum UserRole
{
    Household,
    Corporate,
    Collector,
    Staff,
    Admin
}