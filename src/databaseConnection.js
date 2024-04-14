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

    console.log("Retrieved one to one relationships...");

    const manyToManyRelationships = allRelationships.filter(r => r.tableName.includes(r.referencedTableName));
    console.log("Retrieved many to many relationships..");

    const oneToManyRelationships = allRelationships.filter(r => {
        return !oneToOneRelationships.find(o => o.tableName === r.tableName && o.referencedTableName === r.referencedTableName) 
            && !manyToManyRelationships.find(m => m.tableName === r.tableName && m.referencedTableName === r.referencedTableName);
    
    });
    console.log("Retrieved one to many relationships...");

    const tableQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";

    const tableResults = await pool.query(tableQuery);

    const tables = tableResults.rows.map(row => row.table_name);

    const tableMap = new Map();

    for (const t of tables) {
        console.log("Retrieving columns for table " + t + "...");
        const columnQuery = `SELECT
                c.column_name,
                c.data_type,
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
                c.data_type,
                c.character_maximum_length;
    `

        const columnResults = await pool.query(columnQuery);

        const columns = columnResults.rows.map(row => ({
            columnName: row.column_name,
            dataType: row.data_type.replaceAll(" ", "_") + (row.characgter_maximum_length ? "_" + row.character_maximum_length : ""),
            isUniqueKey: row.constraint_types.includes("UNIQUE"),
            isPrimaryKey: row.constraint_types.includes("PRIMARY KEY"),
            isForeignKey: row.constraint_types.includes("FOREIGN KEY")       
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

