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
    const tableColumnsMap = new Map();

    let allMermaidString = "erDiagram\n";

    for (const [table, v] of schemaTables) {
        const mermaidString = writeTableAndColumns(table, v.columns);
        schemaTablesMap.set(table, mermaidString);
        tableColumnsMap.set(table, mermaidString);
        allMermaidString += mermaidString;
    }

    for (const [table, v] of schemaTables) {
        for (const r of v.relationships.oneToOne) {
            const relationship = `\t${r.tableName} ||--|| ${r.referencedTableName} : has\n`;
            allMermaidString += relationship;

            let mermaidString = schemaTablesMap.get(table);
            const primaryTable = tableColumnsMap.get(r.tableName);
            const relatedTable = tableColumnsMap.get(r.referencedTableName);

            const hasPrimaryTable = mermaidString.includes(primaryTable);
            const hasRelatedTable = mermaidString.includes(relatedTable);

            if (!hasPrimaryTable) {
                mermaidString += primaryTable;
            }

            if (!hasRelatedTable) {
                mermaidString += relatedTable;
            }

            let hasRelationship = mermaidString.includes(relationship);
            if (!hasRelationship) {
                schemaTablesMap.set(table, mermaidString + relationship);
            }

            mermaidString = schemaTablesMap.get(r.referencedTableName);
            hasRelationship = mermaidString.includes(relationship);
            if (!hasRelationship) {
                schemaTablesMap.set(r.referencedTableName, mermaidString + relationship);
            }
        }

        for (const r of v.relationships.oneToMany) {
            const relationship = `\t${r.tableName} ||--o{ ${r.referencedTableName} : has\n`;
            allMermaidString += relationship;

            let mermaidString = schemaTablesMap.get(table);
            const primaryTable = tableColumnsMap.get(r.tableName);
            const relatedTable = tableColumnsMap.get(r.referencedTableName);

            const hasPrimaryTable = mermaidString.includes(primaryTable);
            const hasRelatedTable = mermaidString.includes(relatedTable);

            if (!hasPrimaryTable) {
                mermaidString += primaryTable;
            }

            if (!hasRelatedTable) {
                mermaidString += relatedTable;
            }
            
            let hasRelationship = mermaidString.includes(relationship);
            if (!hasRelationship) {
                schemaTablesMap.set(table, mermaidString + relationship);
            }

            mermaidString = schemaTablesMap.get(r.referencedTableName);
            hasRelationship = mermaidString.includes(relationship);
            if (!hasRelationship) {
                schemaTablesMap.set(r.referencedTableName, mermaidString + relationship);
            }
        }

        for (const r of v.relationships.manyToMany) {
            const relationship = `\t${r.tableName} }o--o{ ${r.referencedTableName} : has\n`;
            allMermaidString += relationship;

            let mermaidString = schemaTablesMap.get(table);
            const primaryTable = tableColumnsMap.get(r.tableName);
            const relatedTable = tableColumnsMap.get(r.referencedTableName);

            const hasPrimaryTable = mermaidString.includes(primaryTable);
            const hasRelatedTable = mermaidString.includes(relatedTable);

            if (!hasPrimaryTable) {
                mermaidString += primaryTable;
            }

            if (!hasRelatedTable) {
                mermaidString += relatedTable;
            }

            let hasRelationship = mermaidString.includes(relationship);
            if (!hasRelationship) {
                schemaTablesMap.set(table, mermaidString + relationship);
            }

            mermaidString = schemaTablesMap.get(r.referencedTableName);
            hasRelationship = mermaidString.includes(relationship);
            if (!hasRelationship) {
                schemaTablesMap.set(r.referencedTableName, mermaidString + relationship);
            }
        }
    }

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