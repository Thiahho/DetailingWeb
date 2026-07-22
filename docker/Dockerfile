# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["backend/Turneo.Api/Turneo.Api.csproj", "backend/Turneo.Api/"]
RUN dotnet restore "backend/Turneo.Api/Turneo.Api.csproj"
COPY backend/Turneo.Api/ backend/Turneo.Api/
WORKDIR "/src/backend/Turneo.Api"
RUN dotnet publish "Turneo.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080
ENTRYPOINT ["dotnet", "Turneo.Api.dll"]
