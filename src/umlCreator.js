import { getPostgresSchema } from './databaseConnection.js';
import fs from "fs";
import { execSync } from 'child_process';

export const createUMLs = async (username, password, host, port, database, schema) => {
    let schemaTables = [];

    try {
        schemaTables = await getPostgresSchema(username, password, host, port, database, schema);
    } catch (error) {
        console.error('Error:', error);
        return;
    }

    const schemaTablesMap = new Map();

    let allMermaidString = "";

    for (const [table, v] of schemaTables) {
        let mermaidString = writeTableAndColumns(table, v.columns);
        for (const r of v.oneToOnes) {
            mermaidString += r ;
        }

        for (const r of v.oneToManys) {
            mermaidString += r;
        }

        for (const r of v.manyToManys) {
            mermaidString += r;
        }

        schemaTablesMap.set(table, mermaidString);
        allMermaidString += mermaidString +"\n";
    }

    allMermaidString = "erDiagram\n" + allMermaidString;

    for (const [table, mermaidString] of schemaTablesMap) {
        console.log("Creating UML for table:", table);
        const finalString = "erDiagram\n" + mermaidString + "\n";
        fs.writeFileSync(`diagrams/${schema}-${table}.mmd`, finalString);
        execSync(`mmdc -i diagrams/${schema}-${table}.mmd -o diagrams/${schema}-${table}.png`);
        fs.unlinkSync(`diagrams/${schema}-${table}.mmd`);
        console.log(`${table} created successfully!`);
    }

    console.log("Creating UML for all tables...");
    fs.writeFileSync(`diagrams/${schema}-all.mmd`, allMermaidString);
    execSync(`mmdc -i diagrams/${schema}-all.mmd -o diagrams/${schema}-all.png`);
    fs.unlinkSync(`diagrams/${schema}-all.mmd`);
    console.log("Complete database UML created successfully!");

    process.exit(0);
};

const writeTableAndColumns = (table, columns) => {
    const usedColumnNames = [];

    let mermaidString = `\t${table} {\n`;

    for (const c of columns) {
        if (usedColumnNames.includes(c.columnName)) {
            continue;
        }

        let dataType = c.dataType.replace(" ", "").toUpperCase();

        if (c.characterMaximumLength) {
            dataType += `(${c.characterMaximumLength})`;
        }

        mermaidString += `\t\t${dataType} ${c.columnName}`;

        const keyStrings = [];
        if (c.isPrimaryKey) {
            keyStrings.push("PK");
        }

        if (c.isForeignKey) {
            keyStrings.push("FK");
        }   
        
        if (keyStrings.length > 0) {
            mermaidString += " " + keyStrings.join(", ");
        }
        
        mermaidString += "\n";

        usedColumnNames.push(c.columnName);
    }

    mermaidString += "\t}\n";

    return mermaidString;
};