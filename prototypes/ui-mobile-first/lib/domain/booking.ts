import type { Booking, BookingStatus } from "./types";

export type BookingEvent =
  | { type: "submit" }
  | { type: "propose"; personId: string }
  | { type: "withdrawProposal" }
  | { type: "confirm" }
  | { type: "reject" }
  | { type: "release" };

const allowed: Record<BookingEvent["type"], BookingStatus[]> = {
  submit: ["Draft"],
  propose: ["Requested", "Proposed"],
  withdrawProposal: ["Proposed"],
  confirm: ["Proposed"],
  reject: ["Requested", "Proposed"],
  release: ["Confirmed"],
};

export type TransitionResult = { ok: true; booking: Booking } | { ok: false; error: string };

export function transition(booking: Booking, event: BookingEvent): TransitionResult {
  if (!allowed[event.type].includes(booking.status)) {
    return { ok: false, error: `Cannot ${event.type} a booking in ${booking.status}` };
  }
  switch (event.type) {
    case "submit":
      return { ok: true, booking: { ...booking, status: "Requested" } };
    case "propose":
      return { ok: true, booking: { ...booking, status: "Proposed", personId: event.personId } };
    case "withdrawProposal":
      return { ok: true, booking: { ...booking, status: "Requested", personId: null } };
    case "confirm":
      return booking.personId
        ? { ok: true, booking: { ...booking, status: "Confirmed" } }
        : { ok: false, error: "Cannot confirm without a person" };
    case "reject":
      return { ok: true, booking: { ...booking, status: "Rejected" } };
    case "release":
      return { ok: true, booking: { ...booking, status: "Released" } };
  }
}

export const isHard = (b: Booking) => b.status === "Confirmed";
export const isSoft = (b: Booking) => b.status === "Proposed";
export const occupiesCapacity = (b: Booking) => isHard(b) || isSoft(b);
