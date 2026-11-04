namespace Turneo.Api.Tests.Unit;

public class BookingTimeRangeTests
{
    private static readonly DateTime Start = new(2030, 5, 10, 10, 0, 0);
    private static readonly DateTime SlotEnd = new(2030, 5, 10, 10, 30, 0);

    [Fact]
    public void WithServiceDuration_EndsAfterTheDuration()
    {
        var range = BookingTimeRange.From(Start, SlotEnd, 180);

        Assert.Equal(Start, range.Start);
        Assert.Equal(new DateTime(2030, 5, 10, 13, 0, 0), range.End);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(-15)]
    public void WithoutServiceDuration_EndsWithTheSlot(int? durationMinutes)
    {
        var range = BookingTimeRange.From(Start, SlotEnd, durationMinutes);

        Assert.Equal(Start, range.Start);
        Assert.Equal(SlotEnd, range.End);
    }

    // A duration shorter than the slot still wins: the booking occupies its real time.
    [Fact]
    public void ShorterThanTheSlot_EndsAfterTheDuration()
    {
        Assert.Equal(Start.AddMinutes(15), BookingTimeRange.From(Start, SlotEnd, 15).End);
    }

    [Fact]
    public void ApplyTo_SetsTheBookingRange()
    {
        var booking = new Booking();

        BookingTimeRange.From(Start, SlotEnd, 60).ApplyTo(booking);

        Assert.Equal(Start, booking.StartDateTime);
        Assert.Equal(Start.AddMinutes(60), booking.EndDateTime);
    }
}
