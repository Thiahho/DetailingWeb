using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.Catalog;

public sealed record VariantSyncResult(int Created, int Reactivated, int Deactivated, int Total);

public interface ICatalogVariantGenerator
{
    // Syncs the product's variants with its allowed values and saves. Callers that
    // also write the product run both inside one transaction (see the admin
    // controllers) so a failure here rolls the product write back too.
    Task<VariantSyncResult> SyncAsync(int productId, CancellationToken ct = default);
}

public class CatalogVariantGenerator : ICatalogVariantGenerator
{
    private readonly ApplicationDbContext _db;

    public CatalogVariantGenerator(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<VariantSyncResult> SyncAsync(int productId, CancellationToken ct = default)
    {
        var product = await _db.CatalogProducts
            .Include(p => p.Category).ThenInclude(c => c.Attributes)
            .Include(p => p.AllowedValues).ThenInclude(a => a.AttributeValue)
            .Include(p => p.Variants)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new KeyNotFoundException($"Catalog product {productId} not found");

        var plan = VariantPlanner.Plan(
            product.Category.Attributes.OrderBy(a => a.SortOrder).Select(a => a.AttributeId).ToList(),
            product.AllowedValues.Select(a => new VariantValueRef(a.AttributeValue.Id, a.AttributeValue.AttributeId, a.AttributeValue.SortOrder)),
            product.Variants.Select(v => new ExistingVariant(v.CombinationKey, v.IsActive, v.DisabledManually)));

        foreach (var planned in plan.ToCreate)
        {
            product.Variants.Add(new CatalogVariant
            {
                Sku = VariantPlanner.SkuFor(product.Id, planned.CombinationKey),
                CombinationKey = planned.CombinationKey,
                Values = planned.ValueIds.Select(id => new CatalogVariantValue { AttributeValueId = id }).ToList(),
            });
        }

        var byKey = product.Variants.Where(v => v.Id != 0).ToDictionary(v => v.CombinationKey);
        foreach (var key in plan.ToReactivate) byKey[key].IsActive = true;
        foreach (var key in plan.ToDeactivate) byKey[key].IsActive = false;

        await _db.SaveChangesAsync(ct);
        return new VariantSyncResult(plan.ToCreate.Count, plan.ToReactivate.Count, plan.ToDeactivate.Count, plan.Total);
    }
}
