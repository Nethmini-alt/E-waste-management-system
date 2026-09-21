using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.AgentWorkflows.Entities;
using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Shared.Common;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    private readonly IDomainEventDispatcher _dispatcher;

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, IDomainEventDispatcher dispatcher)
        : base(options)
    {
        _dispatcher = dispatcher;
    }

    public DbSet<User> Users => Set<User>();

    // Generator & Submission Manager Tables
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<SubmissionItem> SubmissionItems => Set<SubmissionItem>();
    public DbSet<AIAnalysisResult> AIAnalysisResults => Set<AIAnalysisResult>();
    public DbSet<WarehouseLocation> WarehouseLocations => Set<WarehouseLocation>();
    public DbSet<RatePolicy> RatePolicies => Set<RatePolicy>();
    public DbSet<ExtraWasteReceipt> ExtraWasteReceipts => Set<ExtraWasteReceipt>();
    public DbSet<ExtraWasteReceiptItem> ExtraWasteReceiptItems => Set<ExtraWasteReceiptItem>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<ProcessingLog> ProcessingLogs => Set<ProcessingLog>();
    public DbSet<ClassificationRecord> ClassificationRecords => Set<ClassificationRecord>();
    public DbSet<CollectorPayment> CollectorPayments => Set<CollectorPayment>();

    // Collection & Logistics Tables
    public DbSet<Collector> Collectors => Set<Collector>();
    public DbSet<Job> Jobs => Set<Job>();
    
    public DbSet<JobAssignmentHistory> JobAssignmentHistory => Set<JobAssignmentHistory>();

        // Component D — Sales / Commercial
    public DbSet<Buyer> Buyers => Set<Buyer>();
    public DbSet<MaterialPricing> MaterialPricings => Set<MaterialPricing>();
    public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
    public DbSet<SalesOrderItem> SalesOrderItems => Set<SalesOrderItem>();
    public DbSet<ExportOrder> ExportOrders => Set<ExportOrder>();
    public DbSet<ExportOrderItem> ExportOrderItems => Set<ExportOrderItem>();
    public DbSet<RevenueTransaction> RevenueTransactions => Set<RevenueTransaction>();
    public DbSet<CommercialPlan> CommercialPlans => Set<CommercialPlan>();
    public DbSet<ApprovalAction> ApprovalActions => Set<ApprovalAction>();

    // Agentic AI workflows (what the agents did, and the staff decision on it)
    public DbSet<AgentWorkflow> AgentWorkflows => Set<AgentWorkflow>();
    public DbSet<AgentStep> AgentSteps => Set<AgentStep>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

    // Only apply Postgres-specific concurrency handling when Postgres is actually the
    // provider — lets tests run against SQLite without dragging in Npgsql-only concepts.
    if (Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType).UseXminAsConcurrencyToken();
            }
        }
    }
}

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Grab events BEFORE saving, because ClearDomainEvents() below empties them
        // and we still need the list after the save succeeds.
        var entitiesWithEvents = ChangeTracker.Entries<BaseEntity>()
            .Select(e => e.Entity)
            .Where(e => e.DomainEvents.Count > 0)
            .ToList();

        var result = await base.SaveChangesAsync(cancellationToken);

        // Only dispatch AFTER the save succeeds — if SaveChangesAsync throws above,
        // we never reach these lines, so handlers never fire for data that wasn't actually persisted.
        var events = entitiesWithEvents.SelectMany(e => e.DomainEvents).ToList();
        entitiesWithEvents.ForEach(e => e.ClearDomainEvents());

        if (events.Count > 0)
        {
            await _dispatcher.DispatchAsync(events, cancellationToken);
        }

        return result;
    }
}