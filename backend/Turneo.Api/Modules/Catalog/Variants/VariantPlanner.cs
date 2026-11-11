namespace Turneo.Api.Modules.Catalog;

public sealed record VariantValueRef(int Id, int AttributeId, int SortOrder);

public sealed record ExistingVariant(string CombinationKey, bool IsActive);

public sealed record PlannedVariant(string CombinationKey, IReadOnlyList<int> ValueIds);

public sealed record VariantPlan(
    IReadOnlyList<PlannedVariant> ToCreate,
    IReadOnlyList<string> ToReactivate,
    IReadOnlyList<string> ToDeactivate,
    int Total);

// Pure variant planning, free of EF so it can be unit-tested: the wanted
// combinations are the cartesian product of the product's allowed values,
// grouped by the category's attribute order. Existing variants are matched by
// combination key; obsolete ones are deactivated, never deleted.
public static class VariantPlanner
{
    public static VariantPlan Plan(
        IReadOnlyList<int> categoryAttributeOrder,
        IEnumerable<VariantValueRef> allowedValues,
        IEnumerable<ExistingVariant> existing)
    {
        var allowed = allowedValues.ToList();
        var groups = categoryAttributeOrder
            .Select(attributeId => (IReadOnlyList<int>)allowed
                .Where(v => v.AttributeId == attributeId)
                .OrderBy(v => v.SortOrder)
                .ThenBy(v => v.Id)
                .Select(v => v.Id)
                .ToList())
            .Where(g => g.Count > 0)
            .ToList();

        var existingByKey = existing.ToDictionary(v => v.CombinationKey);
        var wanted = new HashSet<string>();
        var toCreate = new List<PlannedVariant>();
        var toReactivate = new List<string>();

        foreach (var combo in Combine(groups))
        {
            var key = KeyFor(combo);
            if (!wanted.Add(key)) continue;

            if (!existingByKey.TryGetValue(key, out var variant))
                toCreate.Add(new PlannedVariant(key, combo));
            else if (!variant.IsActive)
                toReactivate.Add(key);
        }

        var toDeactivate = existingByKey.Values
            .Where(v => v.IsActive && !wanted.Contains(v.CombinationKey))
            .Select(v => v.CombinationKey)
            .ToList();

        return new VariantPlan(toCreate, toReactivate, toDeactivate, wanted.Count);
    }

    // Cartesian product; with no groups it yields one empty combination
    // (a product without attributes still has a single variant).
    public static List<List<T>> Combine<T>(IReadOnlyList<IReadOnlyList<T>> groups)
    {
        var result = new List<List<T>> { new() };
        foreach (var group in groups)
            result = result.SelectMany(prefix => group.Select(item => new List<T>(prefix) { item })).ToList();
        return result;
    }

    public static string KeyFor(IEnumerable<int> valueIds) => string.Join('-', valueIds.Order());

    // SKU = "P{productId}" plus "-{combinationKey}" when the product has attributes.
    // Built only from ids, so it is unique per tenant (product ids are unique and
    // combination keys are unique per product), never collides between products
    // whatever their names or labels, and stays stable when the product is renamed.
    // Its length is bounded by MaxAttributesPerCategory, far below SkuMaxLength.
    public static string SkuFor(int productId, string combinationKey)
    {
        var sku = combinationKey.Length == 0 ? $"P{productId}" : $"P{productId}-{combinationKey}";
        if (sku.Length > CatalogLimits.SkuMaxLength)
            throw new InvalidOperationException($"SKU exceeds {CatalogLimits.SkuMaxLength} characters");
        return sku;
    }
}
