using System.Collections.Concurrent;

namespace EWasteManagement.API.Features.Auth.Services;

public interface ILoginAttemptTracker
{
    bool IsLockedOut(string email);
    void RecordFailure(string email);
    void RecordSuccess(string email);
}

// DEF-SEC-01: brute-force protection for sign-in. After MaxFailures wrong passwords for the same
// email within Window, that email is locked for LockoutDuration — even the correct password is
// refused until it expires. Unknown emails are counted the same way, so the response never tells
// an attacker whether an account exists.
//
// In memory and per API instance (registered as a singleton): enough for one server; a deployment
// with several instances would keep these counters in a shared store instead.
public class LoginAttemptTracker : ILoginAttemptTracker
{
    public const int MaxFailures = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    private sealed record Entry(int Failures, DateTimeOffset FirstFailureAt, DateTimeOffset? LockedUntil);

    private readonly ConcurrentDictionary<string, Entry> _entries = new();
    private readonly TimeProvider _time;

    public LoginAttemptTracker(TimeProvider? time = null) => _time = time ?? TimeProvider.System;

    public bool IsLockedOut(string email) =>
        _entries.TryGetValue(Key(email), out var entry)
        && entry.LockedUntil is { } until
        && until > _time.GetUtcNow();

    public void RecordFailure(string email)
    {
        var now = _time.GetUtcNow();
        _entries.AddOrUpdate(Key(email),
            _ => new Entry(1, now, null),
            (_, entry) =>
            {
                // A finished lockout or an old run of failures starts counting again from one.
                var expired = entry.LockedUntil is { } until ? until <= now : now - entry.FirstFailureAt > Window;
                var current = expired ? new Entry(0, now, null) : entry;
                var failures = current.Failures + 1;
                return current with
                {
                    Failures = failures,
                    LockedUntil = failures >= MaxFailures ? now + LockoutDuration : current.LockedUntil,
                };
            });
    }

    public void RecordSuccess(string email) => _entries.TryRemove(Key(email), out _);

    private static string Key(string email) => (email ?? string.Empty).Trim().ToLowerInvariant();
}
