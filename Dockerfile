# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["DetailingApi/DetailingApi.csproj", "DetailingApi/"]
RUN dotnet restore "DetailingApi/DetailingApi.csproj"
COPY DetailingApi/ DetailingApi/
WORKDIR "/src/DetailingApi"
RUN dotnet publish "DetailingApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080
ENTRYPOINT ["dotnet", "DetailingApi.dll"]
