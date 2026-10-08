using EWasteManagement.API.Features.Auth.DTOs;
using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Auth.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Admin;

// DEF-SEC-01 — brute-force protection on sign-in (LoginAttemptTracker + AuthService.LoginAsync).
public class LoginLockoutTests : IAsyncLifetime
{
    private const string Email = "pat@test.com";
    private const string Password = "secret1";

    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private readonly ManualClock _clock = new();
    private LoginAttemptTracker _attempts = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        _db = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options,
            new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();
        _attempts = new LoginAttemptTracker(_clock);
        await Auth().RegisterAsync(new RegisterRequest { FullName = "Pat", Email = Email, Password = Password, Role = "Household" });
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    private sealed class FakeJwtService : IJwtService
    {
        public string GenerateToken(User user) => "token";
    }

    private sealed class ManualClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 10, 8, 9, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private AuthService Auth() => new(_db, new FakeJwtService(), _attempts);

    private Task<AuthResponse> Login(string password, string email = Email) =>
        Auth().LoginAsync(new LoginRequest { Email = email, Password = password });

    private async Task FailTimes(int times, string email = Email)
    {
        for (var i = 0; i < times; i++)
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Login("wrong-password", email));
    }

    [Fact]
    public async Task FourWrongPasswords_StillAllowsTheCorrectOne()
    {
        await FailTimes(LoginAttemptTracker.MaxFailures - 1);

        var result = await Login(Password);

        Assert.Equal("token", result.Token);
    }

    [Fact]
    public async Task FiveWrongPasswords_LockTheAccount_EvenForTheCorrectPassword()
    {
        await FailTimes(LoginAttemptTracker.MaxFailures);

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Login(Password));
        Assert.Contains("Too many failed sign-in attempts", ex.Message);
    }

    [Fact]
    public async Task Lockout_EndsAfter15Minutes()
    {
        await FailTimes(LoginAttemptTracker.MaxFailures);

        _clock.Now += LoginAttemptTracker.LockoutDuration - TimeSpan.FromSeconds(1);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Login(Password));

        _clock.Now += TimeSpan.FromSeconds(1);
        Assert.Equal("token", (await Login(Password)).Token);
    }

    [Fact]
    public async Task ASuccessfulLogin_ResetsTheCount()
    {
        await FailTimes(LoginAttemptTracker.MaxFailures - 1);
        await Login(Password);

        await FailTimes(LoginAttemptTracker.MaxFailures - 1);

        Assert.Equal("token", (await Login(Password)).Token);
    }

    [Fact]
    public async Task FailuresSpreadOverMoreThan15Minutes_DoNotLock()
    {
        await FailTimes(LoginAttemptTracker.MaxFailures - 1);
        _clock.Now += LoginAttemptTracker.Window + TimeSpan.FromSeconds(1);

        await FailTimes(1);

        Assert.Equal("token", (await Login(Password)).Token);
    }

    [Fact]
    public async Task Lockout_IsPerAccount_AndIgnoresEmailCase()
    {
        await Auth().RegisterAsync(new RegisterRequest { FullName = "Sam", Email = "sam@test.com", Password = Password, Role = "Household" });

        await FailTimes(LoginAttemptTracker.MaxFailures, " PAT@Test.com ");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Login(Password));
        Assert.Equal("token", (await Login(Password, "sam@test.com")).Token);
    }

    [Fact]
    public async Task UnknownEmails_AreCountedTheSameWay_SoTheyCannotBeToldApart()
    {
        const string unknown = "nobody@test.com";
        await FailTimes(LoginAttemptTracker.MaxFailures, unknown);

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Login("anything", unknown));
        Assert.Contains("Too many failed sign-in attempts", ex.Message);
    }
}
