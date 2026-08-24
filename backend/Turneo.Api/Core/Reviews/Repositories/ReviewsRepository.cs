using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Reviews;

public class ReviewsRepository : IReviewsRepository
{
    private readonly ApplicationDbContext _context;

    public ReviewsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Review>> GetApprovedAsync() =>
        _context.Reviews
            .Where(r => r.IsApproved)
            .OrderBy(r => r.Order)
            .ThenByDescending(r => r.CreatedAt)
            .ToListAsync();

    public Task<List<Review>> GetAllAsync() =>
        _context.Reviews
            .OrderBy(r => r.Order)
            .ThenByDescending(r => r.CreatedAt)
            .ToListAsync();

    public Task<Review?> FindAsync(int id) => _context.Reviews.FindAsync(id).AsTask();

    public void Add(Review review) => _context.Reviews.Add(review);

    public void Remove(Review review) => _context.Reviews.Remove(review);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
