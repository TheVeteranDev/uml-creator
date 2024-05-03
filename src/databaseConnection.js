import pg from "pg";
import fs from "fs";

export const getPostgresSchema = async (user, password, host, port, database, schema) => {
    const pool = new pg.Pool({
        user: user,
        password: password,
        host: host,
        port: port,
        database: database,
        // ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    });

    console.log("Connecting to database...");

    await pool.connect();

    console.log("Connected to database");

    const tableQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}'`;

    const tableResults = await pool.query(tableQuery);

    const tables = tableResults.rows.map(row => row.table_name);

    const tableMap = new Map();

    for (const t of tables) {
        console.log("Retrieving columns for table " + t + "...");
        const columnQuery = `SELECT
                c.column_name,
                c.udt_name AS data_type,
                c.character_maximum_length,
                ARRAY_AGG(
                    CASE
                        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRIMARY KEY'
                        WHEN tc.constraint_type = 'UNIQUE' THEN 'UNIQUE'
                        WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FOREIGN KEY'
                        ELSE 'NONE'
                    END
                ) AS constraint_types
            FROM
                information_schema.columns AS c
            LEFT JOIN
                information_schema.key_column_usage AS kcu
            ON
                c.column_name = kcu.column_name
            LEFT JOIN
                information_schema.table_constraints AS tc
            ON
                kcu.constraint_name = tc.constraint_name
            WHERE
                c.table_name = '${t}'
            GROUP BY
                c.column_name,
                c.udt_name,
                c.character_maximum_length;
    `

        const columnResults = await pool.query(columnQuery);

        const columns = columnResults.rows.map(row => ({
            columnName: row.column_name,
            dataType: row.data_type,
            characterMaximumLength: row.character_maximum_length,
            isUniqueKey: row.constraint_types.includes("UNIQUE"),
            isPrimaryKey: row.constraint_types.includes("PRIMARY KEY"),
            isForeignKey: row.constraint_types.includes("FOREIGN KEY")       
        }));

        console.log("Columns retrieved for table " + t);

        tableMap.set(t, { 
            columns: columns,
            oneToOnes: [],
            oneToManys: [],
            manyToManys: []
        });

        console.log("Retrieving relationships for table " + t + "...");

        const relationshipsQuery = `
            SELECT
                conname AS constraint_name,
                conrelid::regclass AS origin_table,
                confrelid::regclass AS referenced_table,
                kcu.column_name AS column_name,
                tc.constraint_type AS constraint_type
            FROM
                pg_constraint
            JOIN
                information_schema.key_column_usage AS kcu ON kcu.constraint_name = conname
            JOIN
                information_schema.table_constraints AS tc ON tc.constraint_name = conname
            WHERE
                connamespace = (
                    SELECT oid
                    FROM pg_namespace
                    WHERE nspname = '${schema}'
                ) 
                AND conrelid = '${t}'::regclass;  
        `;

        const relationshipsResults = await pool.query(relationshipsQuery);
        const rows = relationshipsResults.rows;

        if (rows.length > 0) {
            const unique = rows.filter(row => row.constraint_type === "UNIQUE");
            const pks = rows.filter(row => row.constraint_type === "PRIMARY KEY");
            const fks = rows.filter(row => row.constraint_type === "FOREIGN KEY");

            if (fks.length === 1 && unique.length === 1 && pks.length === 1) {
                const mermaidString = `\t${t} ||--|| ${fks[0].referenced_table} : has\n`;
                tableMap.get(t).oneToOnes.push(mermaidString);
            }

            if (fks.length === 1 && unique.length === 0 && pks.length === 1) {
                const mermaidString = `\t${t} ||--o{ ${fks[0].referenced_table} : has\n`;
                tableMap.get(t).oneToManys.push(mermaidString);
            }

            if (fks.length > 1 && unique.length === 0 && pks.length > 1) {
                for (const fk of fks) {
                    const mermaidString = `\t${t} }o--o{ ${fk.referenced_table} : has\n`;
                    tableMap.get(t).manyToManys.push(mermaidString);
                }
            }
        }
    }

    pool.end();

    return tableMap;
};

