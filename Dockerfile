# Usar imagen base de .NET 10.0
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

# Usar SDK para compilar
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["DetailingApi/DetailingApi.csproj", "DetailingApi/"]
RUN dotnet restore "DetailingApi/DetailingApi.csproj"
COPY . .
WORKDIR "/src/DetailingApi"
RUN dotnet build "DetailingApi.csproj" -c Release -o /app/build

# Publicar aplicación
FROM build AS publish
RUN dotnet publish "DetailingApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Imagen final
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Copiar credenciales de Google Calendar (desde la etapa build donde están los archivos)
COPY --from=build /src/DetailingApi/credentials.json ./credentials.json
COPY --from=build /src/DetailingApi/token.json/Google.Apis.Auth.OAuth2.Responses.TokenResponse-user ./token.json/Google.Apis.Auth.OAuth2.Responses.TokenResponse-user

# Configurar para escuchar en el puerto que Render asigna
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "DetailingApi.dll"]
