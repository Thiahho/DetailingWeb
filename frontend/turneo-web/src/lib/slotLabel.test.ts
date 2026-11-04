import { describe, expect, it } from "vitest";
import { groupSlotsByDay, slotRangeLabel, splitSlotLabel } from "@/src/lib/slotLabel";

describe("slotRangeLabel", () => {
  it("appends the end of the booking range when it differs from the slot end", () => {
    expect(
      slotRangeLabel({
        label: "jue 05/nov · 10:00",
        endDateTime: "2026-11-05T11:00:00",
        bookingEndDateTime: "2026-11-05T13:00:00",
      })
    ).toBe("jue 05/nov · 10:00 – 13:00");
  });

  it("keeps the label when the range ends with the slot", () => {
    expect(
      slotRangeLabel({
        label: "jue 05/nov · 10:00",
        endDateTime: "2026-11-05T11:00:00",
        bookingEndDateTime: "2026-11-05T11:00:00",
      })
    ).toBe("jue 05/nov · 10:00");
  });

  it("keeps the label when the API does not send a range", () => {
    expect(slotRangeLabel({ label: "jue 05/nov · 10:00", endDateTime: "2026-11-05T11:00:00" })).toBe("jue 05/nov · 10:00");
    expect(slotRangeLabel({ label: "jue 05/nov · 10:00", bookingEndDateTime: null })).toBe("jue 05/nov · 10:00");
  });

  it("still splits and groups by day after the range is appended", () => {
    const label = slotRangeLabel({
      label: "jue 05/nov · 10:00",
      endDateTime: "2026-11-05T11:00:00",
      bookingEndDateTime: "2026-11-05T13:00:00",
    });
    expect(splitSlotLabel(label)).toMatchObject({ dayPart: "jue 05/nov", time: "10:00 – 13:00" });
    expect(groupSlotsByDay([{ label }, { label: "jue 05/nov · 14:00" }])).toHaveLength(1);
  });
});
