using System.Text;
using EWasteManagement.Api.Services;
using EWasteManagement.API.Features.Auth.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Features.Processing.Events;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using EWasteManagement.API.Shared.Common;
using FluentValidation;
using FluentValidation.AspNetCore;
using EWasteManagement.API.Features.Collection.Services;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Features.Processing.Services;

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
builder.Services.AddHttpClient<ISubmissionService, SubmissionService>();
builder.Services.AddHttpClient<IGoogleMapsService, GoogleMapsService>();

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