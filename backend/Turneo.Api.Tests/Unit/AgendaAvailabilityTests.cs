namespace Turneo.Api.Tests.Unit;

// Pure availability rule (AgendaCoverage + AgendaSnapshot): coverage by the
// business' open slots, overlap with active bookings of the same professional
// and the at-home travel buffer, all on real ranges.
public class AgendaAvailabilityTests
{
    private const int Professional = 7;
    private static readonly DateTime Day = new(2030, 5, 10);

    private static DateTime At(double hour) => Day.AddHours(hour);

    private static AgendaSlot Slot(int id, double from, double to, int? professionalId = Professional, bool isBlocked = false) =>
        new(id, professionalId, At(from), At(to), isBlocked);

    private static OccupiedRange Booking(int id, double from, double to, int? professionalId = Professional, bool atHome = false) =>
        new(id, professionalId, At(from), At(to), atHome);

    private static AgendaSnapshot Snapshot(
        IEnumerable<AgendaSlot> slots,
        IEnumerable<OccupiedRange>? bookings = null,
        IEnumerable<BlockedDay>? blockedDays = null,
        int travelBufferMinutes = 0) =>
        new(slots, bookings ?? [], blockedDays ?? [], TimeSpan.FromMinutes(travelBufferMinutes));

    private static BookingCandidate Candidate(AgendaSlot start, double endHour, int? professionalId = Professional, bool atHome = false, int? excludeBookingId = null) =>
        new(start, professionalId, At(endHour), atHome, excludeBookingId);

    // --- AgendaCoverage --------------------------------------------------------

    private static (DateTime, DateTime) Range(double from, double to) => (At(from), At(to));

    [Fact]
    public void Coverage_ContiguousSlots_CoverTheRange()
    {
        Assert.True(AgendaCoverage.IsCovered(At(10), At(13), [Range(10, 11), Range(11, 12), Range(12, 13)]));
    }

    [Fact]
    public void Coverage_RangeEndingExactlyAtASlotEnd_IsCovered()
    {
        Assert.True(AgendaCoverage.IsCovered(At(10), At(11.5), [Range(10, 11), Range(11, 11.5)]));
    }

    [Fact]
    public void Coverage_RangeEndingInsideASlot_IsCovered()
    {
        Assert.True(AgendaCoverage.IsCovered(At(10), At(11.25), [Range(10, 11), Range(11, 12)]));
    }

    [Fact]
    public void Coverage_GapOfThirtyMinutes_StillCounts()
    {
        Assert.True(AgendaCoverage.IsCovered(At(10), At(13), [Range(10, 11), Range(11.5, 13)]));
    }

    [Fact]
    public void Coverage_GapOfThirtyOneMinutes_Breaks()
    {
        var afterGap = At(11).AddMinutes(31);
        Assert.False(AgendaCoverage.IsCovered(At(10), At(13), [Range(10, 11), (afterGap, At(14))]));
    }

    [Fact]
    public void Coverage_RangeLongerThanTheLastSlot_IsNotCovered()
    {
        Assert.False(AgendaCoverage.IsCovered(At(10), At(13), [Range(10, 11), Range(11, 12)]));
    }

    [Fact]
    public void Coverage_OverlappingAndUnorderedSlots_Chain()
    {
        Assert.True(AgendaCoverage.IsCovered(At(10), At(13), [Range(12, 13), Range(10, 11), Range(10.5, 12)]));
    }

    [Fact]
    public void Coverage_NoSlotAtTheStart_IsNotCovered()
    {
        // The tolerance is only between slots, never before the start.
        Assert.False(AgendaCoverage.IsCovered(At(10), At(11), [Range(10.25, 12)]));
    }

    // --- AgendaSnapshot.Evaluate -------------------------------------------------

    [Fact]
    public void ServiceWithoutDuration_LoneSlot_IsAvailable()
    {
        var start = Slot(1, 10, 11);
        Assert.Equal(AvailabilityVerdict.Available, Snapshot([start]).Evaluate(Candidate(start, 11)));
    }

    [Fact]
    public void LongService_CoveredByTheProfessionalsSlots_IsAvailable()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start, Slot(2, 11, 12), Slot(3, 12, 13)]);
        Assert.Equal(AvailabilityVerdict.Available, snapshot.Evaluate(Candidate(start, 13)));
    }

    [Fact]
    public void LongService_CoveredOnlyByAnotherProfessionalsSlots_IsNotCovered()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start, Slot(2, 11, 12, professionalId: 99), Slot(3, 12, 13, professionalId: 99)]);
        Assert.Equal(AvailabilityVerdict.NotCovered, snapshot.Evaluate(Candidate(start, 13)));
    }

    [Fact]
    public void BlockedSlotInTheMiddle_BreaksCoverage()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start, Slot(2, 11, 12, isBlocked: true), Slot(3, 12, 13)]);
        Assert.Equal(AvailabilityVerdict.NotCovered, snapshot.Evaluate(Candidate(start, 13)));
    }

    [Fact]
    public void BlockedDateOfTheBusiness_BreaksCoverage()
    {
        // 22:00 to 01:00 crosses into a day the business blocked.
        var start = Slot(1, 22, 23);
        var snapshot = Snapshot([start, Slot(2, 23, 24), Slot(3, 24, 25)],
            blockedDays: [new BlockedDay(Day.AddDays(1), null)]);
        Assert.Equal(AvailabilityVerdict.NotCovered, snapshot.Evaluate(Candidate(start, 25)));
    }

    [Fact]
    public void BlockedDateOfTheProfessional_MakesTheStartSlotUnavailable()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start], blockedDays: [new BlockedDay(Day, Professional)]);
        Assert.Equal(AvailabilityVerdict.NotCovered, snapshot.Evaluate(Candidate(start, 11)));
    }

    [Fact]
    public void BlockedDateOfAnotherProfessional_DoesNotMatter()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start], blockedDays: [new BlockedDay(Day, 99)]);
        Assert.Equal(AvailabilityVerdict.Available, snapshot.Evaluate(Candidate(start, 11)));
    }

    [Fact]
    public void OverlapWithABookingOfTheSameProfessional_IsRejected()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start, Slot(2, 11, 12), Slot(3, 12, 13)], bookings: [Booking(50, 12.5, 13.5)]);
        Assert.Equal(AvailabilityVerdict.Overlap, snapshot.Evaluate(Candidate(start, 13)));
    }

    [Fact]
    public void AdjacentBooking_DoesNotOverlap()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start], bookings: [Booking(50, 11, 12), Booking(51, 9, 10)]);
        Assert.Equal(AvailabilityVerdict.Available, snapshot.Evaluate(Candidate(start, 11)));
    }

    [Fact]
    public void OverlapWithAnotherProfessionalsBooking_IsAllowed()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start], bookings: [Booking(50, 10, 11, professionalId: 99)]);
        Assert.Equal(AvailabilityVerdict.Available, snapshot.Evaluate(Candidate(start, 11)));
    }

    [Fact]
    public void BookingsWithoutProfessional_ShareOneResource()
    {
        var start = Slot(1, 10, 11, professionalId: null);
        var snapshot = Snapshot([start], bookings: [Booking(50, 10.5, 11.5, professionalId: null)]);
        Assert.Equal(AvailabilityVerdict.Overlap, snapshot.Evaluate(Candidate(start, 11, professionalId: null)));
    }

    [Fact]
    public void TheBookingBeingMoved_IsExcluded()
    {
        var start = Slot(1, 11, 12);
        var snapshot = Snapshot([Slot(0, 10, 11), start, Slot(2, 12, 13), Slot(3, 13, 14)], bookings: [Booking(50, 10, 13)]);
        Assert.Equal(AvailabilityVerdict.Overlap, snapshot.Evaluate(Candidate(start, 14)));
        Assert.Equal(AvailabilityVerdict.Available, snapshot.Evaluate(Candidate(start, 14, excludeBookingId: 50)));
    }

    [Fact]
    public void Overlap_IsReportedBeforeCoverage()
    {
        var start = Slot(1, 10, 11);
        var snapshot = Snapshot([start], bookings: [Booking(50, 12, 13)]);
        Assert.Equal(AvailabilityVerdict.Overlap, snapshot.Evaluate(Candidate(start, 13)));
    }

    [Fact]
    public void TravelBuffer_UsesTheRealRangeOfBothBookings()
    {
        var start = Slot(1, 11, 12);
        var slots = new[] { start, Slot(2, 12, 13), Slot(3, 13, 14) };
        // At-home booking 14:00-15:00; the new at-home range 11:00-14:00 leaves no travel time.
        var snapshot = Snapshot(slots, bookings: [Booking(50, 14, 15, atHome: true)], travelBufferMinutes: 30);

        Assert.Equal(AvailabilityVerdict.InsideTravelBuffer, snapshot.Evaluate(Candidate(start, 14, atHome: true)));
        // Its own slot range (11-12) would have kept two hours of distance.
        Assert.Equal(AvailabilityVerdict.Available, snapshot.Evaluate(Candidate(start, 12, atHome: true)));
    }

    [Fact]
    public void TravelBuffer_IgnoresOnSiteBookingsAndOnSiteCandidates_AndZeroDisablesIt()
    {
        var start = Slot(1, 11, 12);
        var onSiteNeighbour = Snapshot([start], bookings: [Booking(50, 12, 13)], travelBufferMinutes: 30);
        var atHomeNeighbour = Snapshot([start], bookings: [Booking(50, 12, 13, atHome: true)], travelBufferMinutes: 30);
        var disabled = Snapshot([start], bookings: [Booking(50, 12, 13, atHome: true)], travelBufferMinutes: 0);

        Assert.Equal(AvailabilityVerdict.Available, onSiteNeighbour.Evaluate(Candidate(start, 12, atHome: true)));
        Assert.Equal(AvailabilityVerdict.Available, atHomeNeighbour.Evaluate(Candidate(start, 12, atHome: false)));
        Assert.Equal(AvailabilityVerdict.InsideTravelBuffer, atHomeNeighbour.Evaluate(Candidate(start, 12, atHome: true)));
        Assert.Equal(AvailabilityVerdict.Available, disabled.Evaluate(Candidate(start, 12, atHome: true)));
    }

    [Fact]
    public void OccupyingBooking_IsTheOwnBookingOrAnOverlappingOneOfTheSameProfessional()
    {
        var snapshot = Snapshot([], bookings: [new OccupiedRange(50, Professional, At(10), At(13), false, TimeSlotId: 1)]);

        Assert.Equal(50, snapshot.OccupyingBookingId(Slot(1, 10, 11)));
        Assert.Equal(50, snapshot.OccupyingBookingId(Slot(2, 12, 13)));
        Assert.Null(snapshot.OccupyingBookingId(Slot(3, 13, 14)));
        Assert.Null(snapshot.OccupyingBookingId(Slot(4, 11, 12, professionalId: 99)));
        // The booking's own slot is occupied whatever its professional.
        Assert.Equal(50, snapshot.OccupyingBookingId(Slot(1, 10, 11, professionalId: null)));
    }
}
