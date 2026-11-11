using Turneo.Api.Modules.Catalog;

namespace Turneo.Api.Tests.Unit.Catalog;

public class VariantPlannerTests
{
    // Category with two attributes in this order: Talle (id 1), Color (id 2).
    private static readonly IReadOnlyList<int> AttributeOrder = new[] { 1, 2 };

    private static VariantValueRef Value(int id, int attributeId, int sortOrder = 0) => new(id, attributeId, sortOrder);

    [Fact]
    public void Plan_CreatesCartesianProductOfAllowedValues()
    {
        var allowed = new[] { Value(10, 1), Value(11, 1), Value(20, 2), Value(21, 2), Value(22, 2) };

        var plan = VariantPlanner.Plan(AttributeOrder, allowed, Array.Empty<ExistingVariant>());

        Assert.Equal(6, plan.Total);
        Assert.Equal(6, plan.ToCreate.Count);
        Assert.Contains(plan.ToCreate, c => c.CombinationKey == "10-20" && c.ValueIds.SequenceEqual(new[] { 10, 20 }));
        Assert.Contains(plan.ToCreate, c => c.CombinationKey == "11-22");
        Assert.Empty(plan.ToReactivate);
        Assert.Empty(plan.ToDeactivate);
    }

    [Fact]
    public void Plan_GroupsFollowCategoryAttributeOrderAndValueSortOrder()
    {
        // Color first in the category; values sorted by SortOrder, not by id.
        var allowed = new[] { Value(30, 2, sortOrder: 2), Value(31, 2, sortOrder: 1), Value(10, 1) };

        var plan = VariantPlanner.Plan(new[] { 2, 1 }, allowed, Array.Empty<ExistingVariant>());

        Assert.Equal(new[] { 31, 10 }, plan.ToCreate[0].ValueIds);
        Assert.Equal(new[] { 30, 10 }, plan.ToCreate[1].ValueIds);
        // The key is canonical: sorted ids regardless of attribute order.
        Assert.Equal("10-31", plan.ToCreate[0].CombinationKey);
    }

    [Fact]
    public void Plan_IgnoresValuesOfAttributesOutsideTheCategory()
    {
        var allowed = new[] { Value(10, 1), Value(99, 7) };

        var plan = VariantPlanner.Plan(AttributeOrder, allowed, Array.Empty<ExistingVariant>());

        Assert.Single(plan.ToCreate);
        Assert.Equal("10", plan.ToCreate[0].CombinationKey);
    }

    [Fact]
    public void Plan_WithoutAllowedValues_ProducesSingleEmptyCombination()
    {
        var plan = VariantPlanner.Plan(AttributeOrder, Array.Empty<VariantValueRef>(), Array.Empty<ExistingVariant>());

        Assert.Equal(1, plan.Total);
        Assert.Equal(string.Empty, plan.ToCreate.Single().CombinationKey);
    }

    [Fact]
    public void Plan_KeepsExistingReactivatesInactiveAndDeactivatesObsolete()
    {
        var allowed = new[] { Value(10, 1), Value(11, 1) };
        var existing = new[]
        {
            new ExistingVariant("10", IsActive: true),   // still wanted, untouched
            new ExistingVariant("11", IsActive: false),  // wanted again → reactivated
            new ExistingVariant("12", IsActive: true),   // no longer allowed → deactivated
            new ExistingVariant("13", IsActive: false),  // obsolete and already inactive → untouched
        };

        var plan = VariantPlanner.Plan(AttributeOrder, allowed, existing);

        Assert.Empty(plan.ToCreate);
        Assert.Equal(new[] { "11" }, plan.ToReactivate);
        Assert.Equal(new[] { "12" }, plan.ToDeactivate);
        Assert.Equal(2, plan.Total);
    }

    [Fact]
    public void SkuFor_IsDerivedFromProductIdAndCombinationKey()
    {
        Assert.Equal("P42-10-20", VariantPlanner.SkuFor(42, "10-20"));
        Assert.Equal("P42", VariantPlanner.SkuFor(42, string.Empty));
    }

    [Fact]
    public void SkuFor_DifferentProductsWithSameValuesNeverCollide()
    {
        Assert.NotEqual(VariantPlanner.SkuFor(1, "10-20"), VariantPlanner.SkuFor(2, "10-20"));
        // AccFenix bug M3: "soporte-2" + "40" and "soporte" + "2-40" produced the same text.
        Assert.NotEqual(VariantPlanner.SkuFor(12, "3"), VariantPlanner.SkuFor(1, "23"));
    }

    [Fact]
    public void SkuFor_WithLargestIdsAndMaxAttributes_FitsTheColumn()
    {
        var ids = Enumerable.Range(0, CatalogLimits.MaxAttributesPerCategory).Select(i => int.MaxValue - i);
        var key = VariantPlanner.KeyFor(ids);

        var sku = VariantPlanner.SkuFor(int.MaxValue, key);

        Assert.True(key.Length <= CatalogLimits.CombinationKeyMaxLength);
        Assert.True(sku.Length <= CatalogLimits.SkuMaxLength);
    }

    [Fact]
    public void KeyFor_SortsIds()
    {
        Assert.Equal("3-7-12", VariantPlanner.KeyFor(new[] { 12, 3, 7 }));
    }

    [Theory]
    [InlineData("Remera Básica 2.40", "remera-basica-2-40")]
    [InlineData("  ¡Ñandú!  ", "nandu")]
    [InlineData("---", "")]
    public void Slug_From_NormalizesText(string text, string expected)
    {
        Assert.Equal(expected, CatalogSlug.From(text, 180));
    }

    [Fact]
    public void Slug_From_TruncatesWithoutTrailingDash()
    {
        var slug = CatalogSlug.From("abcd efgh", 5);

        Assert.Equal("abcd", slug);
    }
}
