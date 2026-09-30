namespace EWasteManagement.API.Features.Auth.Entities;

// Only set when Role is Staff. Management staff use the web app; Worker staff use only the
// Flutter warehouse app and are issued the "Worker" role claim instead of "Staff".
public enum StaffType
{
    Management,
    Worker
}
