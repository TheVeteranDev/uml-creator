import { createUMLs } from "./umlCreator.js";

export const main = async (event, context) => {
    for (const schema of event["schemas"]) {
        await createUMLs(
            event["username"],
            event["password"],
            event["host"],
            event["port"],
            event["database"],
            schema
        )
    }
}

const event = {
    username: "postgres", 
    password: "postgres123", 
    host: "localhost", 
    port: "5432", 
    database: "postgres", 
    schemas: ["public"]
}

main(event, undefined);