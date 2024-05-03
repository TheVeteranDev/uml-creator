# UML Creator
Create UML diagrams for your database.

## How to:
1.  Clone this repository
<div data-copyable> git clone https://github.com/TheVeteranDev/uml-creator.git </div>

2.  Open the src/main.js file and change the "event" object to the information for your database.
<div data-copyable>
const event = {
    username: "YOUR_DB_USERNAME", 
    password: "YOUR_DB_PASSWORD", 
    host: "localhost", 
    port: "5432", 
    database: "postgres", 
    schemas: ["public"]
}
</div>