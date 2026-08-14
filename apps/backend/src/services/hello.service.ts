import { CustomError } from "@/http/errors"

const RESERVED_NAMES = ["admin", "root"]

//the example domain: a service with no dependencies at all.
//
//what it demonstrates is the shape. a service owns one domain behind a class
//with a callable method surface — persistence is the most common dependency,
//not the definition of one. a db-backed service takes its handle in the
//constructor (`constructor(private db: Db)`) and the route wires it with
//`new HelloService(getDb(c.env.DB))`; nothing else about it changes.
//
//note where the failure lives: the service decides `invalid_input` and throws,
//and the global catcher renders the envelope. the route never sees it.
export class HelloService {
  greet(name: string): string {
    if (RESERVED_NAMES.includes(name.toLowerCase())) {
      throw new CustomError("invalid_input")
    }

    return `Hello, ${name}!`
  }
}
