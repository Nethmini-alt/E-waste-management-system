using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<User> Users => Set<User>();

    // Generator & Submission Manager Tables
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<SubmissionItem> SubmissionItems => Set<SubmissionItem>();
    public DbSet<AIAnalysisResult> AIAnalysisResults => Set<AIAnalysisResult>();

    // Collection & Logistics Tables
    public DbSet<Collector> Collectors => Set<Collector>();
    public DbSet<Job> Jobs => Set<Job>();
    
    public DbSet<JobAssignmentHistory> JobAssignmentHistory => Set<JobAssignmentHistory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}