FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore EWasteManagement.API.csproj
RUN dotnet publish EWasteManagement.API.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000
CMD ASPNETCORE_URLS=http://+:${PORT:-10000} dotnet EWasteManagement.API.dll