import pg from "pg";
import fs from "fs";

export const getPostgresSchema = async (user, password, host, port, database) => {
    const pool = new pg.Pool({
        user: user,
        password: password,
        host: host,
        port: port,
        database: database,
    });

    console.log("Connecting to database...");

    await pool.connect();

    console.log("Connected to database");

    const allRelatsionshipsQuery = fs.readFileSync("sqls/allRelationships.sql", "utf8");

    const allRelationshipsResults = await pool.query(allRelatsionshipsQuery);

    const allRelationships = allRelationshipsResults.rows.map(row => ({
        tableName: row.table_name,
        referencedTableName: row.referenced_table_name
    }));

    const oneToOneQuery = fs.readFileSync("sqls/oneToOne.sql", "utf8");

    const oneToOneResults = await pool.query(oneToOneQuery);

    const oneToOneRelationships = oneToOneResults.rows.map(row => ({
        tableName: row.table_name,
        referencedTableName: row.referenced_table_name
    }));

    console.log("\n\nRetrieved one to one relationships");

    const manyToManyRelationships = allRelationships.filter(r => r.tableName.includes(r.referencedTableName));
    console.log("\n\nRetrieved many to many relationships");

    const oneToManyRelationships = allRelationships.filter(r => {
        return !oneToOneRelationships.find(o => o.tableName === r.tableName && o.referencedTableName === r.referencedTableName) 
            && !manyToManyRelationships.find(m => m.tableName === r.tableName && m.referencedTableName === r.referencedTableName);
    
    });
    console.log("\n\nRetrieved one to many relationships");

    // const relationshipQuery = "SELECT kcu.constraint_name, kcu.table_name, tc.constraint_type, kcu.column_name " +
    //     "FROM information_schema.key_column_usage kcu " +
    //     "LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name " +
    //     "WHERE kcu.table_schema = 'public' AND kcu.constraint_name IS NOT NULL";

    // const relationshipResults = await pool.query(relationshipQuery);

    // const relationships = relationshipResults.rows.map(row => ({
    //     constraintName: row.constraint_name,
    //     tableName: row.table_name,
    //     constraintType: row.constraint_type,
    //     columnName: row.column_
    // })).filter(r => r.constraintType.includes(r.tableName));

    // console.log("Retrieved relationships");

    const tableQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";

    const tableResults = await pool.query(tableQuery);

    const tables = tableResults.rows.map(row => row.table_name);

    const tableMap = new Map();

    for (const t of tables) {
        const columnQuery = "SELECT c.column_name, c.data_type, kcu.constraint_name " +
            "FROM information_schema.columns c " +
            "LEFT JOIN information_schema.key_column_usage kcu " +
            "ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name " +
            "WHERE c.table_name = '" + t + "' " +
            "ORDER BY c.column_name";

        const columnResults = await pool.query(columnQuery);

        const columns = columnResults.rows.map(row => ({
            columnName: row.column_name,
            dataType: row.data_type.replaceAll(" ", "_"),
            isUniqueKey: row.constraint_type === "UNIQUE",
            isPrimaryKey: row.constraint_type === "PRIMARY KEY",
            isForeignKey: row.constraint_type === "FOREIGN KEY",
        }));

        const oneToOnes = oneToOneRelationships.filter(r => r.tableName === t);
        const oneToManys = oneToManyRelationships.filter(r => r.tableName === t);
        const manyToManys = manyToManyRelationships.filter(r => r.tableName === t);

        const relationships = {
            oneToOne: oneToOnes,
            oneToMany: oneToManys,
            manyToMany: manyToManys
        };

        tableMap.set(t, {columns: columns, relationships: relationships});
    }

    pool.end();

    return tableMap;
};

const isPrimaryKey = (relationships, tableName, columnName) => {
    for (const r of relationships) {
        if (r.tableName === tableName && r.constraintType === "PRIMARY KEY" && r.columnName === columnName) {
            console.log("Primary key found for " + tableName + "." + columnName);
            return true;
        }
    }

    return false;
}

const isForeignKey = (relationships, tableName, columnName) => {
    for (const r of relationships) {
        if (r.tableName === tableName && r.constraintType === "FOREIGN KEY" && r.columnName === columnName) {
            console.log("Foreign key found for " + tableName + "." + columnName);
            return true;
        }
    }

    return false;
}

// const findOneToOne = (relationships, tableName, constraintName) => {
//     if (constraintName == null) {
//         return undefined;
//     }

//     const constraint = relationships.find(r => r.constraintName === constraintName && r.tableName === tableName);
//     if (!constraint) {
//         return undefined;
//     }

//     if (constraint.constraintType === "UNIQUE") {
//         const foreignKey = relationships.find(r => r.constraintType === "FOREIGN KEY" && r.columnName === constraint.columnName && r.tableName === constraint.tableName);
//         if (!foreignKey) {
//             return undefined;
//         }

//         const tableColumn = getRelationship(relationships, constraint);
//         if (tableColumn) {
//             console.log("One to one found for " + tableName);
//             return `\t${tableColumn.tableName} ||--|| ${constraint.tableName} : has\n`;
//         }
//     }
// }

// const findOneToMany = (relationships, tableName, constraintName) => {
//     if (constraintName == null) {
//         return undefined;
//     }

//     const constraint = relationships.find(r => r.constraintName === constraintName && r.tableName === tableName);
//     if (!constraint) {
//         return undefined;
//     }

//     if (constraint.constraintType === "UNIQUE") {
//         return undefined;
//     }

//     if (relationships.find(r => r.constraintType === "UNIQUE" && r.columnName === constraint.columnName && r.tableName === constraint.tableName)) {
//         return undefined;
//     }

//     if (constraint.constraintType === "FOREIGN KEY") {
//         const tableColumn = getRelationship(relationships, constraint);
//         if (tableColumn) {
//             console.log("One to many found for " + tableName);
//             return `\t${tableColumn.tableName} ||--o{ ${constraint.tableName} : has\n`; 
//         }      
//     }
// }

// const findManyToMany = (relationships, tableName, constraintName) => {
//     if (constraintName === null) {
//         return undefined;
//     }

//     const constraint = relationships.find(r => r.constraintName === constraintName && r.tableName === tableName);
//     if (!constraint) {
//         return undefined;
//     }

//     if (constraint.constraintType === "UNIQUE") {
//         return undefined;
//     }

//     if (constraint.constraintType === "FOREIGN KEY") {
//         const primaryKey = relationships.find(r => r.constraintType === "PRIMARY KEY" && r.columnName === constraint.columnName && r.tableName === constraint.tableName);
//         if (primaryKey) {
//             const tableColumn = getRelationship(relationships, constraint);   
//             if (tableColumn) {
//                 console.log("Many to many found for " + tableName);
//                 return `\t${tableColumn.tableName} }o--o{ ${constraint.tableName} : has\n`;
//             }         
//         }
//     }

// }

// const getRelationship = (relationships, constraint) => {
//     const tableColumnSplit = constraint.columnName.split("_");
//         let index = 0;

//         while (true) {
//             const table = relationships.find(r => r.tableName === tableColumnSplit.slice(0, index).join("_"));
//             if (!table) {
//                 index++;
//                 continue;
//             }

//             const columnName = tableColumnSplit.slice(index).join("_");
//             const tableColumn = relationships.find(r => r.tableName === table.tableName && r.columnName === columnName);

//             if (!tableColumn) {
//                 index++;
//                 continue;
//             }

//             return tableColumn;
//         }       
// }

