using Microsoft.AspNetCore.Mvc;
using Turneo.Api.Modules.HomeService.ServiceArea;

namespace Turneo.Api.Tests.Unit;

// A duplicate that slips past the pre-check (concurrent request) is rejected by
// the unique index at save time; the controller must answer 400, not 500.
public class CoverageLocalitiesControllerTests
{
    private sealed class UniqueViolationOnSaveRepository : ICoverageLocalitiesRepository
    {
        private readonly CoverageLocality _existing = new() { Id = 1, Name = "Ramos Mejia", Province = "Buenos Aires" };

        public Task<List<CoverageLocality>> GetAllAsync() => Task.FromResult(new List<CoverageLocality> { _existing });
        public Task<CoverageLocality?> FindAsync(int id) => Task.FromResult<CoverageLocality?>(id == 1 ? _existing : null);
        public Task<bool> ExistsAsync(string name, string province, string? georefId, int? excludeId = null) => Task.FromResult(false);
        public void Add(CoverageLocality locality) { }
        public void Remove(CoverageLocality locality) { }
        public Task<int> SaveChangesAsync() => Task.FromResult(1);
        public Task<bool> TrySaveChangesAsync() => Task.FromResult(false);
    }

    private static CoverageLocalityRequest Request() => new() { Name = "Ciudadela", Province = "Buenos Aires" };

    [Fact]
    public async Task Create_WhenSaveHitsUniqueIndex_ReturnsBadRequest()
    {
        var controller = new CoverageLocalitiesController(new UniqueViolationOnSaveRepository());

        var result = await controller.Create(Request());

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Update_WhenSaveHitsUniqueIndex_ReturnsBadRequest()
    {
        var controller = new CoverageLocalitiesController(new UniqueViolationOnSaveRepository());

        var result = await controller.Update(1, Request());

        Assert.IsType<BadRequestObjectResult>(result);
    }
}
