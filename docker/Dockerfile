# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["backend/TTurnos.Api/TTurnos.Api.csproj", "backend/TTurnos.Api/"]
RUN dotnet restore "backend/TTurnos.Api/TTurnos.Api.csproj"
COPY backend/TTurnos.Api/ backend/TTurnos.Api/
WORKDIR "/src/backend/TTurnos.Api"
RUN dotnet publish "TTurnos.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080
ENTRYPOINT ["dotnet", "TTurnos.Api.dll"]
