namespace Turneo.Api.Tests.Integration;

// Un solo contenedor Postgres + un solo host de la app para toda la suite de
// integración: levantar Testcontainers y correr migraciones + seed de
// Hangfire por clase de test sería mucho más lento sin ganar aislamiento real
// (cada test ya usa datos con IDs/slugs únicos para no pisarse).
[CollectionDefinition("Integration")]
public class IntegrationTestCollection : ICollectionFixture<CustomWebApplicationFactory>
{
}
