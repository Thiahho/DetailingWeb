namespace TTurnos.Api.SaaS.Subscriptions;

// Solo aplica al modelo comercial SaaS. En License/Custom, el tenant no tiene
// Subscription — su acceso está gobernado por License en su lugar.
public class Subscription : ITenantScoped
{
    public int Id { get; set; }

    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public int PlanId { get; set; }
    public Plan? Plan { get; set; }

    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trialing;

    public DateTime CurrentPeriodStart { get; set; }
    public DateTime CurrentPeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
