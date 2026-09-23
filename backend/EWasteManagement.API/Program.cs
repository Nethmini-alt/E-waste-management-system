using System.Text;
using EWasteManagement.Api.Services;
using EWasteManagement.API.Features.Auth.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Features.Processing.Events;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

using EWasteManagement.API.Features.Sales.Services;
using EWasteManagement.API.Infrastructure.Middleware;
using FluentValidation;
using FluentValidation.AspNetCore;
using EWasteManagement.API.Infrastructure.ExternalServices;

using EWasteManagement.API.Shared.Common;
using EWasteManagement.API.Features.Collection.Services;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Features.Workflow.Services;
using EWasteManagement.API.Infrastructure.BackgroundTasks;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste ONLY the token - no 'Bearer ' prefix."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Database Context (PostgreSQL Persistence)
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Services Registration
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<ICollectorService, CollectorService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<IJobService, JobService>();
builder.Services.AddScoped<ISubmissionService, SubmissionService>();
builder.Services.AddScoped<IJobVerificationService, JobVerificationService>();
builder.Services.AddScoped<IJobReceiptService, JobReceiptService>();
builder.Services.AddScoped<IRatePolicyLookupService, RatePolicyLookupService>();
builder.Services.AddScoped<IPaymentCalculator, JobPaymentCalculator>();
builder.Services.AddScoped<IPaymentCalculator, ExtraWastePaymentCalculator>();
builder.Services.AddScoped<ICollectorPaymentService, CollectorPaymentService>();
builder.Services.AddScoped<IInventoryProcessingService, InventoryProcessingService>();
builder.Services.AddScoped<IClassificationValidationService, ClassificationValidationService>();
builder.Services.AddHttpClient<IGeoService, OpenStreetMapService>();

// Component D — Sales services
builder.Services.AddScoped<IBuyerService, BuyerService>();
builder.Services.AddScoped<IMaterialPricingService, MaterialPricingService>();
builder.Services.AddScoped<IRevenueService, RevenueService>();
builder.Services.AddScoped<ISalesOrderService, SalesOrderService>();
builder.Services.AddScoped<IExportOrderService, ExportOrderService>();
builder.Services.AddScoped<ICommercialPlanService, CommercialPlanService>();

// Component D — external data providers
builder.Services.AddSingleton<IRecoveredMaterialsProvider, StubRecoveredMaterialsProvider>();
builder.Services.AddHttpClient<IAgentClient, AgentClient>();

// --- Intake-and-collection-planning agentic workflow (slice 3) ---
builder.Services.AddScoped<IWorkflowService, WorkflowService>();
builder.Services.AddScoped<IWorkflowOrchestrationService, WorkflowOrchestrationService>();
builder.Services.AddHttpClient<IPlannerAgentClient, PlannerAgentClient>();
builder.Services.AddHttpClient<IAnalyzerAgentClient, AnalyzerAgentClient>();
builder.Services.AddHttpClient<IValidatorAgentClient, ValidatorAgentClient>();
builder.Services.AddHttpClient<IMatcherAgentClient, MatcherAgentClient>();

// Singleton: one queue shared by every request and by the background
// processor. WorkflowQueueProcessor is a BackgroundService — it starts
// with the app and runs for the app's whole lifetime.
builder.Services.AddSingleton<IWorkflowBackgroundQueue, WorkflowBackgroundQueue>();
builder.Services.AddHostedService<WorkflowQueueProcessor>();

// FluentValidation — scans the assembly for AbstractValidator<T> classes
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"]?? "SuperSecretKeyForEWasteManagementProject2026SecureKey!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// CORS Policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowClients", policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddScoped<IDomainEventDispatcher, SimpleDomainEventDispatcher>();
builder.Services.AddScoped<IDomainEventHandler<InventoryStatusChangedEvent>, InventoryStatusChangedEventHandler>();
builder.Services.AddScoped<IExtraWasteReceiptService, ExtraWasteReceiptService>();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseExceptionHandler();

// Pipeline Configuration
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowClients");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();