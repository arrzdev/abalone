import { describe, expect, it } from "vitest"
import { isPrivateOrigin } from "@/utils/is-private-origin"

//true is what lets an origin into CORS and better-auth's trusted origins in
//dev, so every false below is a door that stays shut.
describe("isPrivateOrigin", () => {
  it.each([
    "http://localhost",
    "http://localhost:6161",
    "https://localhost:7171",
    "http://10.0.0.1:7171",
    "http://10.255.255.255",
    "http://192.168.1.20:7171",
    "http://172.16.0.1",
    "http://172.20.4.5:7171",
    "http://172.31.255.255",
  ])("trusts %s", (origin) => {
    expect(isPrivateOrigin(origin)).toBe(true)
  })

  it.each([
    "https://example.com",
    //the public neighbours of the 172.16.0.0/12 block
    "http://172.15.0.1",
    "http://172.32.0.1",
    "http://192.169.1.1",
    "http://11.0.0.1",
    //hosts that only start or end like a private one
    "http://localhost.example.com",
    "http://example.com.localhost.evil.net",
    "http://10.0.0.1.example.com",
    "http://192.168.1.1.nip.io",
  ])("refuses the public origin %s", (origin) => {
    expect(isPrivateOrigin(origin)).toBe(false)
  })

  //only the hostname counts: credentials or a path that look private do not
  //make a public host private
  it("refuses a public host dressed up with a private-looking userinfo or path", () => {
    expect(isPrivateOrigin("http://localhost@evil.example.com")).toBe(
      false,
    )
    expect(isPrivateOrigin("http://evil.example.com/localhost")).toBe(
      false,
    )
  })

  //loopback forms other than the name `localhost` are not on the list. that
  //fails closed: a dev on 127.0.0.1 or [::1] is refused, never a stranger let in
  it.each([
    "http://127.0.0.1:6161",
    "http://[::1]:6161",
    "http://[fe80::1]",
    "http://[fd00::1]",
    "http://[::ffff:192.168.1.1]",
  ])(
    "does not treat the loopback or IPv6 form %s as private",
    (origin) => {
      expect(isPrivateOrigin(origin)).toBe(false)
    },
  )

  it.each(["", "localhost", "not a url", "//localhost:6161"])(
    "refuses %j, which is not an absolute url",
    (origin) => {
      expect(isPrivateOrigin(origin)).toBe(false)
    },
  )
})
