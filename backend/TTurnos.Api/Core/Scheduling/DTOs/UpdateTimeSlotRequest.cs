using System.ComponentModel.DataAnnotations;

public class UpdateTimeSlotRequest
{
    [Required]
    public DateTime StartDateTime { get; set; }
}