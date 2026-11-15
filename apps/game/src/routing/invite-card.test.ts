import { describe, expect, it } from "vitest"
import { inviteCard } from "@/routing/invite-card"

describe("inviteCard", () => {
  it("names the sender while the link is open", () => {
    const card = inviteCard("Kasparov")

    expect(card.title).toBe("Kasparov invited you to a game of Abalone")
    expect(card.description).toContain("Accept and play Kasparov online.")
    expect(card.image).toBe("game")
  })

  //a spent or unknown link says nothing about who sent it
  it("names nobody for a link that is not open", () => {
    const card = inviteCard(null)

    expect(card.title).toBe("Invite · Abalone")
    expect(card.description).not.toMatch(/invited you|Accept and play/)
    expect(card.image).toBe("home")
  })

  it("treats an empty name as no name", () => {
    expect(inviteCard("")).toEqual(inviteCard(null))
  })
})
