namespace Turneo.Api.Core.Reviews;

public interface IReviewsRepository
{
    Task<List<Review>> GetApprovedAsync();
    Task<List<Review>> GetAllAsync();
    Task<Review?> FindAsync(int id);
    void Add(Review review);
    void Remove(Review review);
    Task<int> SaveChangesAsync();
}
