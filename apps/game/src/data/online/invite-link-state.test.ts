import { describe, expect, it } from "vitest"
import { inviteLinkFromResponse } from "@/data/online/invite-link-state"

//what the public read of an invite link answers, success or refusal, and what
//the invite page is told about it. a link nobody issued, or a paste cut short,
//is "broken": the page says the link does not work, not that it ran out.

describe("inviteLinkFromResponse", () => {
  it("passes an open link through with its sender", () => {
    expect(
      inviteLinkFromResponse({
        status: "success",
        data: { inviterName: "Marta", state: "open" },
      }),
    ).toEqual({ inviterName: "Marta", state: "open" })
  })

  it("keeps a link that ran out as expired", () => {
    expect(
      inviteLinkFromResponse({
        status: "success",
        data: { inviterName: "Marta", state: "expired" },
      }),
    ).toEqual({ inviterName: "Marta", state: "expired" })
  })

  it("keeps a link somebody else took as used", () => {
    expect(
      inviteLinkFromResponse({
        status: "success",
        data: { inviterName: "Marta", state: "used" },
      }),
    ).toEqual({ inviterName: "Marta", state: "used" })
  })

  it("calls a link the server never issued broken", () => {
    expect(
      inviteLinkFromResponse({ status: "error", error_code: "not_found" }),
    ).toEqual({ inviterName: null, state: "broken" })
  })

  //a malformed token is refused before it is looked up
  it("calls a malformed link broken", () => {
    expect(
      inviteLinkFromResponse({
        status: "error",
        error_code: "invalid_input",
      }),
    ).toEqual({ inviterName: null, state: "broken" })
  })

  //anything else is a failure to read, and the page offers to try again
  it("throws on any other refusal", () => {
    expect(() =>
      inviteLinkFromResponse({
        status: "error",
        error_code: "internal_server_error",
      }),
    ).toThrow()
  })
})
